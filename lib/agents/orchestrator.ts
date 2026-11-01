import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient, DEFAULT_MODEL, DEBATE_EFFORT } from '@/lib/anthropic'
import { adminDb } from '@/lib/firebase/admin'
import {
  buildRespondentPrompt,
  buildCriticPrompt,
  buildSynthesizerPrompt,
  SYNTHESIZER_TOOL,
} from './prompts'
import type { OrchestratorInput, SSEGenerator } from './types'
import { resumePoint, historyBefore, parseSynthesis, type Synthesis } from './runState'
import type { AgentRole, PanelCompare, SSEEvent, ConfidenceLevel } from '@/types'
import { FieldValue } from 'firebase-admin/firestore'

// Room for thinking (on by default, counted in max_tokens) plus the answer.
const AGENT_MAX_TOKENS = 16000

// Shared with the compare runner (compare.ts).
export async function* streamAgent(
  role: AgentRole,
  prompt: { system: string; user: string },
  model: string,
  signal?: AbortSignal,
): AsyncGenerator<{ token?: string; full: string }> {
  const stream = await getAnthropicClient().messages.create({
    model,
    max_tokens: AGENT_MAX_TOKENS,
    output_config: { effort: DEBATE_EFFORT },
    system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt.user }],
    stream: true,
  }, { signal })

  let full = ''
  let stopReason: string | null = null
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      full += event.delta.text
      yield { token: event.delta.text, full }
    } else if (event.type === 'message_delta') {
      stopReason = event.delta.stop_reason
    }
  }
  // Never store an empty or refused turn as if it were an answer: the next agent would
  // build on it. (Thinking can use up the whole cap before any text.)
  if (stopReason === 'refusal') throw new Error(`The ${role} declined to answer`)
  if (!full.trim()) {
    throw new Error(stopReason === 'max_tokens' ? `The ${role} ran out of room before answering` : `The ${role} returned an empty answer`)
  }
  yield { full }
}

// One structured answer through a tool call (non-streaming tool_use — SACRED S002). Claude
// Sonnet 5.5 rejects a forced tool_choice with a 400, so the choice is "auto", the tool is
// strict and the system prompt says to always call it; if the model answers in text anyway,
// it is told to call the tool and asked once more. Returns input null if no complete tool
// call came back (callers report `stopReason`, e.g. max_tokens for a cut-off answer).
export async function requestToolCall(
  prompt: { system: string; user: string },
  model: string,
  tools: Anthropic.Tool[],
  signal?: AbortSignal,
): Promise<{ input: unknown; stopReason: string | null }> {
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt.user }]
  let stopReason: string | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await getAnthropicClient().messages.create({
      model,
      max_tokens: AGENT_MAX_TOKENS,
      output_config: { effort: DEBATE_EFFORT },
      system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
      tools,
      tool_choice: { type: 'auto' },
      messages,
    }, { signal })
    stopReason = response.stop_reason
    // Out of room or refused: a tool call cut off at max_tokens has incomplete input, and
    // asking again would end the same way.
    if (stopReason === 'max_tokens' || stopReason === 'refusal') break
    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (toolUse?.type === 'tool_use') return { input: toolUse.input, stopReason }
    // Answered in text: keep that turn and point it at the tool.
    if (response.content.some(b => b.type === 'text')) {
      messages.push(
        { role: 'assistant', content: response.content },
        { role: 'user', content: `Call the ${tools[0].name} tool with your answer now.` },
      )
    }
  }
  return { input: null, stopReason }
}

async function callSynthesizer(
  prompt: { system: string; user: string },
  model: string,
  signal?: AbortSignal,
): Promise<Synthesis> {
  const { input, stopReason } = await requestToolCall(prompt, model, SYNTHESIZER_TOOL, signal)
  const synthesis = parseSynthesis(input)
  if (!synthesis) {
    throw new Error(stopReason === 'max_tokens'
      ? "The synthesizer's verdict was cut off"
      : 'The synthesizer did not return a usable verdict')
  }
  return synthesis
}

export class LeaseLostError extends Error {
  constructor() {
    super('Another runner now holds this panel')
  }
}

export type PanelData = {
  rounds?: Record<string, unknown>[]
  run?: { id?: string } | null
  compare?: PanelCompare | null
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
        issuesFound: synthesis.issuesFound,
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
