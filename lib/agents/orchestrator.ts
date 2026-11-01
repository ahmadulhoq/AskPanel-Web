import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient, DEFAULT_MODEL } from '@/lib/anthropic'
import { adminDb } from '@/lib/firebase/admin'
import {
  buildRespondentPrompt,
  buildCriticPrompt,
  buildSynthesizerPrompt,
  SYNTHESIZER_TOOL,
} from './prompts'
import type { OrchestratorInput, SSEGenerator } from './types'
import { resumePoint, historyBefore } from './runState'
import type { AgentRole, SSEEvent, ConfidenceLevel, SynthesisDecision } from '@/types'
import { FieldValue } from 'firebase-admin/firestore'

// Shared with the compare runner (compare.ts).
export async function* streamAgent(
  role: AgentRole,
  prompt: { system: string; user: string },
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<{ token?: string; full: string }> {
  const stream = await getAnthropicClient().messages.create({
    model,
    max_tokens: 1500,
    system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt.user }],
    stream: true,
  }, { signal })

  let full = ''
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      full += event.delta.text
      yield { token: event.delta.text, full }
    }
  }
  yield { full }
}

async function callSynthesizer(
  prompt: { system: string; user: string },
  model: string,
  signal?: AbortSignal,
): Promise<{ decision: SynthesisDecision; confidence: ConfidenceLevel; reasoning: string; issuesFound: number; finalAnswer: string }> {
  const response = await getAnthropicClient().messages.create({
    model,
    max_tokens: 800,
    system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
    tools: SYNTHESIZER_TOOL as Anthropic.Tool[],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: prompt.user }],
  }, { signal })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Synthesizer did not return a tool call')
  }

  const input = toolUse.input as {
    decision: SynthesisDecision
    confidence: ConfidenceLevel
    reasoning: string
    issuesFound: number
    finalAnswer: string
  }
  return input
}

export class LeaseLostError extends Error {
  constructor() {
    super('Another runner now holds this panel')
  }
}

export type PanelData = {
  rounds?: Record<string, unknown>[]
  run?: { id?: string } | null
  compare?: { proposals?: { content: string }[] } | null
}

// Read-modify-write in a transaction, refused if another runner has taken over the panel.
// Shared with the compare runner (compare.ts).
export async function leasedUpdate(
  panelId: string,
  leaseId: string | undefined,
  build: (data: PanelData) => Record<string, unknown>,
) {
  const db = adminDb()
  const ref = db.collection('panels').doc(panelId)
  await db.runTransaction(async (tx) => {
    const data = ((await tx.get(ref)).data() ?? {}) as PanelData
    if (leaseId && data.run?.id !== leaseId) throw new LeaseLostError()
    tx.update(ref, build(data))
  })
}

function withRound(data: PanelData, round: number, patch: Record<string, unknown>) {
  const rounds = [...(data.rounds ?? [])]
  const idx = rounds.findIndex((r) => r.roundNumber === round)
  if (idx === -1) {
    rounds.push({ roundNumber: round, respondent: null, critic: null, synthesizer: null, ...patch })
  } else {
    rounds[idx] = { ...rounds[idx], ...patch }
  }
  return { rounds }
}

export const MAX_ROUNDS = 3

export async function* runPanel(input: OrchestratorInput): SSEGenerator {
  const { panelId, question, config, persona = 'general', context, customPersona, rounds: stored = [], leaseId, signal } = input
  // Cost-sensitive values are never taken from the stored doc as-is: tier limits are
  // enforced at creation, this is the backstop.
  const model = DEFAULT_MODEL
  const maxRounds = Math.min(Math.max(Math.trunc(config.maxRounds) || 2, 1), MAX_ROUNDS)

  // Resume after the last completed step, so an interrupted run never repeats work.
  const start = resumePoint(stored, maxRounds)
  const history = historyBefore(stored, start)
  let finalAnswer = ''
  let finalConfidence: ConfidenceLevel = 'medium'

  try {
    await leasedUpdate(panelId, leaseId, () => ({ status: 'running', 'config.model': model }))

    for (let round = start.round; round <= maxRounds; round++) {
      const resuming = round === start.round

      // ── Respondent ──────────────────────────────────────────────────
      if (!resuming || start.step === 'respondent') {
        const respondentPrompt = buildRespondentPrompt(question, history, persona, round === 1 ? context : undefined, customPersona)
        yield { type: 'agent_start', agent: 'respondent', round } satisfies SSEEvent

        let respondentContent = ''
        for await (const chunk of streamAgent('respondent', respondentPrompt, model, signal)) {
          if (chunk.token) {
            yield { type: 'agent_token', agent: 'respondent', token: chunk.token } satisfies SSEEvent
          }
          respondentContent = chunk.full
        }

        yield { type: 'agent_complete', agent: 'respondent', round, content: respondentContent } satisfies SSEEvent
        history.push({ role: 'respondent', content: respondentContent, round })
        await leasedUpdate(panelId, leaseId, (d) => withRound(d, round, { respondent: { content: respondentContent } }))
      }

      // ── Critic ──────────────────────────────────────────────────────
      if (!resuming || start.step !== 'synthesizer') {
        const criticPrompt = buildCriticPrompt(question, history, persona, customPersona)
        yield { type: 'agent_start', agent: 'critic', round } satisfies SSEEvent

        let criticContent = ''
        for await (const chunk of streamAgent('critic', criticPrompt, model, signal)) {
          if (chunk.token) {
            yield { type: 'agent_token', agent: 'critic', token: chunk.token } satisfies SSEEvent
          }
          criticContent = chunk.full
        }

        yield { type: 'agent_complete', agent: 'critic', round, content: criticContent } satisfies SSEEvent
        history.push({ role: 'critic', content: criticContent, round })
        await leasedUpdate(panelId, leaseId, (d) => withRound(d, round, { critic: { content: criticContent } }))
      }

      // ── Synthesizer ─────────────────────────────────────────────────
      const isFinalRound = round === maxRounds
      const synthPrompt = buildSynthesizerPrompt(question, history, isFinalRound)
      yield { type: 'synthesis_start', round } satisfies SSEEvent

      const synthesis = await callSynthesizer(synthPrompt, model, signal)

      // If the synthesizer still returns 'continue' on the last round, force 'contested'
      if (isFinalRound && synthesis.decision === 'continue') {
        synthesis.decision = 'contested'
        if (!synthesis.confidence || synthesis.confidence === 'high') {
          synthesis.confidence = 'low'
        }
      }

      history.push({ role: 'synthesizer', content: synthesis.reasoning, round })
      const result = {
        decision: synthesis.decision,
        confidence: synthesis.confidence,
        reasoning: synthesis.reasoning,
        issuesFound: synthesis.issuesFound ?? 0,
      }
      await leasedUpdate(panelId, leaseId, (d) => withRound(d, round, { synthesizer: result }))

      yield { type: 'synthesis_result', round, ...result } satisfies SSEEvent

      finalAnswer = synthesis.finalAnswer
      finalConfidence = synthesis.confidence

      if (synthesis.decision !== 'continue') break
    }

    await leasedUpdate(panelId, leaseId, () => ({
      status: 'complete',
      finalAnswer,
      confidence: finalConfidence,
      completedAt: FieldValue.serverTimestamp(),
    }))

    yield { type: 'panel_complete', finalAnswer, confidence: finalConfidence } satisfies SSEEvent
  } catch (err) {
    // Another runner took over, or the run was stopped (the runner aborts on losing its
    // lease): whoever holds the panel now owns its status.
    if (err instanceof LeaseLostError || signal?.aborted) return
    const message = err instanceof Error ? err.message : 'Unknown error'
    await leasedUpdate(panelId, leaseId, () => ({ status: 'error', errorMessage: message })).catch(() => {})
    yield { type: 'error', message } satisfies SSEEvent
  }
}
