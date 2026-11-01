import { FieldValue } from 'firebase-admin/firestore'
import { DEFAULT_MODEL } from '@/lib/anthropic'
import { leasedUpdate, LeaseLostError, requestToolCall, streamAgent } from './orchestrator'
import { buildCompareCriticPrompt, buildJudgePrompt, buildProposerPrompt, buildRevisionPrompt, JUDGE_TOOL } from './comparePrompts'
import { compareResumePoint, emptyCompare, finalProposals, isRevised, parseJudgement, proposerCount } from './compareState'
import type { AgentPrompt } from './prompts'
import type { OrchestratorInput, SSEGenerator } from './types'
import type { SSEEvent } from '@/types'

// Streams one turn as agent_start / agent_token… events; returns the full text (the caller
// stores it, then emits agent_complete).
async function* streamTurn(
  agent: 'proposer' | 'critic',
  index: number | undefined,
  prompt: AgentPrompt,
  model: string,
  signal: AbortSignal | undefined,
  round = 1,
): AsyncGenerator<SSEEvent, string> {
  const at = index !== undefined ? { index } : {}
  yield { type: 'agent_start', agent, round, ...at }
  let full = ''
  for await (const chunk of streamAgent(agent, prompt, model, signal)) {
    if (chunk.token) yield { type: 'agent_token', agent, ...at, token: chunk.token }
    full = chunk.full
  }
  return full
}

// Compare-options run (spec §7.3): Proposers → Critic → (Pro) revisions → Judge, resumable
// after the last stored step. Proposers argue for the user's options when given (BL-051).
// Revisions are proposer turns in round 2, so viewers see them as a second round. Writes go through the same lease check as critique runs; the
// critique loop (orchestrator.ts runPanel) is untouched.
export async function* runCompare(input: OrchestratorInput): SSEGenerator {
  const { panelId, question, persona = 'general', context, customPersona, leaseId, signal } = input
  const model = DEFAULT_MODEL
  const stored = input.compare ?? emptyCompare()
  const proposals = stored.proposals.map((p) => p.content)
  const revisions = (stored.revisions ?? []).map((p) => p.content)
  let critique = stored.critic?.content ?? null
  const count = proposerCount(stored)
  const start = compareResumePoint(stored)

  try {
    await leasedUpdate(panelId, leaseId, () => ({ status: 'running', 'config.model': model }))

    // ── Proposers ────────────────────────────────────────────────────
    for (let i = start.step === 'proposer' ? start.index : count; i < count; i++) {
      const prompt = buildProposerPrompt(question, i, proposals, persona, context, customPersona, stored.options)
      const full = yield* streamTurn('proposer', i, prompt, model, signal)
      proposals.push(full)
      await leasedUpdate(panelId, leaseId, (d) => ({
        'compare.proposals': [...(d.compare?.proposals ?? []).slice(0, i), { content: full }],
      }))
      yield { type: 'agent_complete', agent: 'proposer', round: 1, index: i, content: full } satisfies SSEEvent
    }

    // ── Critic ───────────────────────────────────────────────────────
    if (critique === null) {
      const prompt = buildCompareCriticPrompt(question, proposals, persona, context, customPersona)
      const full = yield* streamTurn('critic', undefined, prompt, model, signal)
      critique = full
      await leasedUpdate(panelId, leaseId, () => ({ 'compare.critic': { content: full } }))
      yield { type: 'agent_complete', agent: 'critic', round: 1, content: full } satisfies SSEEvent
    }

    // ── Revisions (Pro) ──────────────────────────────────────────────
    if (stored.revise) {
      for (let i = start.step === 'revision' ? start.index : revisions.length; i < count; i++) {
        const prompt = buildRevisionPrompt(question, i, proposals, critique, persona, context, customPersona)
        const full = yield* streamTurn('proposer', i, prompt, model, signal, 2)
        revisions.push(full)
        await leasedUpdate(panelId, leaseId, (d) => ({
          'compare.revisions': [...(d.compare?.revisions ?? []).slice(0, i), { content: full }],
        }))
        yield { type: 'agent_complete', agent: 'proposer', round: 2, index: i, content: full } satisfies SSEEvent
      }
    }

    // ── Judge (tool_use, like the Synthesizer) ───────────────────────
    const now = { ...stored, proposals: proposals.map((content) => ({ content })), revisions: revisions.map((content) => ({ content })), critic: { content: critique } }
    const revised = isRevised(now)
    const judged = finalProposals(now)
    yield { type: 'synthesis_start', round: revised ? 2 : 1 } satisfies SSEEvent
    const prompt = buildJudgePrompt(question, judged, critique, context, revised)
    const { input: toolInput, stopReason } = await requestToolCall(prompt, model, JUDGE_TOOL, signal)
    const verdict = parseJudgement(toolInput, judged.length)
    if (!verdict) {
      throw new Error(stopReason === 'max_tokens'
        ? "The judge's verdict was cut off"
        : 'The judge did not return a usable verdict')
    }
    const { finalAnswer, ...judgement } = verdict

    await leasedUpdate(panelId, leaseId, () => ({
      'compare.judgement': judgement,
      status: 'complete',
      finalAnswer,
      confidence: judgement.confidence,
      completedAt: FieldValue.serverTimestamp(),
    }))
    yield { type: 'compare_result', ...judgement } satisfies SSEEvent
    yield { type: 'panel_complete', finalAnswer, confidence: judgement.confidence } satisfies SSEEvent
  } catch (err) {
    // Another runner took over, or the run was stopped: the panel's status isn't ours.
    if (err instanceof LeaseLostError || signal?.aborted) return
    const message = err instanceof Error ? err.message : 'Unknown error'
    await leasedUpdate(panelId, leaseId, () => ({ status: 'error', errorMessage: message })).catch(() => {})
    yield { type: 'error', message } satisfies SSEEvent
  }
}
