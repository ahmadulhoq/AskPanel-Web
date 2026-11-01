import type Anthropic from '@anthropic-ai/sdk'
import { FieldValue } from 'firebase-admin/firestore'
import { getAnthropicClient, DEFAULT_MODEL } from '@/lib/anthropic'
import { leasedUpdate, LeaseLostError, streamAgent } from './orchestrator'
import { buildCompareCriticPrompt, buildJudgePrompt, buildProposerPrompt, JUDGE_TOOL } from './comparePrompts'
import { compareResumePoint, emptyCompare, parseJudgement, PROPOSER_COUNT } from './compareState'
import type { OrchestratorInput, SSEGenerator } from './types'
import type { SSEEvent } from '@/types'

// Compare-options run (spec §7.3): Proposers → Critic → Judge, one round, resumable after
// the last stored step. Writes go through the same lease check as critique runs; the
// critique loop (orchestrator.ts runPanel) is untouched.
export async function* runCompare(input: OrchestratorInput): SSEGenerator {
  const { panelId, question, persona = 'general', context, customPersona, leaseId, signal } = input
  const model = DEFAULT_MODEL
  const stored = input.compare ?? emptyCompare()
  const proposals = stored.proposals.map((p) => p.content)
  let critique = stored.critic?.content ?? null
  const start = compareResumePoint(stored)

  try {
    await leasedUpdate(panelId, leaseId, () => ({ status: 'running', 'config.model': model }))

    // ── Proposers ────────────────────────────────────────────────────
    for (let i = start.step === 'proposer' ? start.index : PROPOSER_COUNT; i < PROPOSER_COUNT; i++) {
      const prompt = buildProposerPrompt(question, i, proposals, persona, context, customPersona)
      yield { type: 'agent_start', agent: 'proposer', round: 1, index: i } satisfies SSEEvent
      let full = ''
      for await (const chunk of streamAgent('proposer', prompt, model, signal)) {
        if (chunk.token) yield { type: 'agent_token', agent: 'proposer', token: chunk.token } satisfies SSEEvent
        full = chunk.full
      }
      proposals.push(full)
      await leasedUpdate(panelId, leaseId, (d) => ({
        'compare.proposals': [...(d.compare?.proposals ?? []).slice(0, i), { content: full }],
      }))
      yield { type: 'agent_complete', agent: 'proposer', round: 1, index: i, content: full } satisfies SSEEvent
    }

    // ── Critic ───────────────────────────────────────────────────────
    if (critique === null) {
      const prompt = buildCompareCriticPrompt(question, proposals, persona, context, customPersona)
      yield { type: 'agent_start', agent: 'critic', round: 1 } satisfies SSEEvent
      let full = ''
      for await (const chunk of streamAgent('critic', prompt, model, signal)) {
        if (chunk.token) yield { type: 'agent_token', agent: 'critic', token: chunk.token } satisfies SSEEvent
        full = chunk.full
      }
      critique = full
      await leasedUpdate(panelId, leaseId, () => ({ 'compare.critic': { content: full } }))
      yield { type: 'agent_complete', agent: 'critic', round: 1, content: full } satisfies SSEEvent
    }

    // ── Judge (tool_use, like the Synthesizer) ───────────────────────
    yield { type: 'synthesis_start', round: 1 } satisfies SSEEvent
    const prompt = buildJudgePrompt(question, proposals, critique, context)
    const response = await getAnthropicClient().messages.create({
      model,
      max_tokens: 1500,
      system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
      tools: JUDGE_TOOL as Anthropic.Tool[],
      tool_choice: { type: 'tool', name: 'judge_options' },
      messages: [{ role: 'user', content: prompt.user }],
    }, { signal })
    const toolUse = response.content.find((b) => b.type === 'tool_use')
    const verdict = parseJudgement(toolUse?.type === 'tool_use' ? toolUse.input : null, proposals.length)
    if (!verdict) throw new Error('The judge did not return a usable verdict')
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
