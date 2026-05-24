import Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient, DEFAULT_MODEL } from '@/lib/anthropic'
import { adminDb } from '@/lib/firebase/admin'
import {
  buildRespondentPrompt,
  buildCriticPrompt,
  buildSynthesizerPrompt,
  SYNTHESIZER_TOOL,
} from './prompts'
import type { ConversationTurn, OrchestratorInput, SSEGenerator } from './types'
import type { SSEEvent, ConfidenceLevel, SynthesisDecision } from '@/types'
import { FieldValue } from 'firebase-admin/firestore'

async function* streamAgent(
  role: 'respondent' | 'critic',
  prompt: { system: string; user: string },
  model: string,
): AsyncGenerator<{ token?: string; full: string }> {
  const stream = await getAnthropicClient().messages.create({
    model,
    max_tokens: 1500,
    system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: prompt.user }],
    stream: true,
  })

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
): Promise<{ decision: SynthesisDecision; confidence: ConfidenceLevel; reasoning: string; finalAnswer: string }> {
  const response = await getAnthropicClient().messages.create({
    model,
    max_tokens: 800,
    system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
    tools: SYNTHESIZER_TOOL as Anthropic.Tool[],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: prompt.user }],
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Synthesizer did not return a tool call')
  }

  const input = toolUse.input as {
    decision: SynthesisDecision
    confidence: ConfidenceLevel
    reasoning: string
    finalAnswer: string
  }
  return input
}

async function updateRoundField(
  panelId: string,
  round: number,
  role: 'respondent' | 'critic',
  content: string,
) {
  const db = adminDb()
  const panelRef = db.collection('panels').doc(panelId)
  const snap = await panelRef.get()
  const data = snap.data()
  const rounds: Record<string, unknown>[] = data?.rounds ?? []

  const idx = rounds.findIndex((r) => r.roundNumber === round)
  if (idx === -1) {
    rounds.push({ roundNumber: round, respondent: null, critic: null, synthesizer: null, [role]: { content } })
  } else {
    rounds[idx] = { ...rounds[idx], [role]: { content } }
  }

  await panelRef.update({ rounds })
}

async function updateSynthesisField(
  panelId: string,
  round: number,
  synthesis: { decision: SynthesisDecision; confidence: ConfidenceLevel; reasoning: string },
) {
  const db = adminDb()
  const panelRef = db.collection('panels').doc(panelId)
  const snap = await panelRef.get()
  const data = snap.data()
  const rounds: Record<string, unknown>[] = data?.rounds ?? []

  const idx = rounds.findIndex((r) => r.roundNumber === round)
  if (idx === -1) {
    rounds.push({ roundNumber: round, respondent: null, critic: null, synthesizer: synthesis })
  } else {
    rounds[idx] = { ...rounds[idx], synthesizer: synthesis }
  }

  await panelRef.update({ rounds })
}

export async function* runPanel(input: OrchestratorInput): SSEGenerator {
  const { panelId, question, config } = input
  const model = config.model ?? DEFAULT_MODEL
  const db = adminDb()
  const panelRef = db.collection('panels').doc(panelId)

  await panelRef.update({ status: 'running' })

  const history: ConversationTurn[] = []
  let finalAnswer = ''
  let finalConfidence: ConfidenceLevel = 'medium'

  try {
    for (let round = 1; round <= config.maxRounds; round++) {
      // ── Respondent ──────────────────────────────────────────────────
      const respondentPrompt = buildRespondentPrompt(question, history)
      yield { type: 'agent_start', agent: 'respondent', round } satisfies SSEEvent

      let respondentContent = ''
      for await (const chunk of streamAgent('respondent', respondentPrompt, model)) {
        if (chunk.token) {
          yield { type: 'agent_token', agent: 'respondent', token: chunk.token } satisfies SSEEvent
        }
        respondentContent = chunk.full
      }

      yield { type: 'agent_complete', agent: 'respondent', round, content: respondentContent } satisfies SSEEvent
      history.push({ role: 'respondent', content: respondentContent, round })
      await updateRoundField(panelId, round, 'respondent', respondentContent)

      // ── Critic ──────────────────────────────────────────────────────
      const criticPrompt = buildCriticPrompt(question, history)
      yield { type: 'agent_start', agent: 'critic', round } satisfies SSEEvent

      let criticContent = ''
      for await (const chunk of streamAgent('critic', criticPrompt, model)) {
        if (chunk.token) {
          yield { type: 'agent_token', agent: 'critic', token: chunk.token } satisfies SSEEvent
        }
        criticContent = chunk.full
      }

      yield { type: 'agent_complete', agent: 'critic', round, content: criticContent } satisfies SSEEvent
      history.push({ role: 'critic', content: criticContent, round })
      await updateRoundField(panelId, round, 'critic', criticContent)

      // ── Synthesizer ─────────────────────────────────────────────────
      const isFinalRound = round === config.maxRounds
      const synthPrompt = buildSynthesizerPrompt(question, history, isFinalRound)
      yield { type: 'synthesis_start', round } satisfies SSEEvent

      const synthesis = await callSynthesizer(synthPrompt, model)

      // If the synthesizer still returns 'continue' on the last round, force 'contested'
      if (isFinalRound && synthesis.decision === 'continue') {
        synthesis.decision = 'contested'
        if (!synthesis.confidence || synthesis.confidence === 'high') {
          synthesis.confidence = 'low'
        }
      }

      history.push({ role: 'synthesizer', content: synthesis.reasoning, round })
      await updateSynthesisField(panelId, round, {
        decision: synthesis.decision,
        confidence: synthesis.confidence,
        reasoning: synthesis.reasoning,
      })

      yield {
        type: 'synthesis_result',
        round,
        decision: synthesis.decision,
        confidence: synthesis.confidence,
        reasoning: synthesis.reasoning,
      } satisfies SSEEvent

      finalAnswer = synthesis.finalAnswer
      finalConfidence = synthesis.confidence

      if (synthesis.decision !== 'continue') break
    }

    await panelRef.update({
      status: 'complete',
      finalAnswer,
      confidence: finalConfidence,
      completedAt: FieldValue.serverTimestamp(),
    })

    yield { type: 'panel_complete', finalAnswer, confidence: finalConfidence } satisfies SSEEvent
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await panelRef.update({ status: 'error', errorMessage: message })
    yield { type: 'error', message } satisfies SSEEvent
  }
}
