import type Anthropic from '@anthropic-ai/sdk'
import type { ConversationTurn } from './types'
import { getPersona } from './personas'

export interface AgentPrompt {
  system: string  // static — will be cached
  user: string    // dynamic — not cached
}

export function buildRespondentPrompt(
  question: string,
  history: ConversationTurn[],
  personaKey = 'general',
  context?: string,
): AgentPrompt {
  const persona = getPersona(personaKey)
  const lastCritique = [...history].reverse().find(t => t.role === 'critic')

  let user: string
  if (lastCritique) {
    user = `Question: ${question}\n\nThe Critic raised the following points:\n${lastCritique.content}`
  } else if (context) {
    user = `${context}\n\nQuestion: ${question}`
  } else {
    user = `Question: ${question}`
  }

  return { system: persona.respondentSystem, user }
}

export function buildCriticPrompt(
  question: string,
  history: ConversationTurn[],
  personaKey = 'general',
): AgentPrompt {
  const persona = getPersona(personaKey)
  const lastRespondent = [...history].reverse().find(t => t.role === 'respondent')
  const user = `Question: ${question}\n\nThe Respondent's answer:\n${lastRespondent?.content ?? ''}`
  return { system: persona.criticSystem, user }
}

export function buildSynthesizerPrompt(
  question: string,
  history: ConversationTurn[],
  isFinalRound: boolean,
): AgentPrompt {
  const SYNTHESIZER_SYSTEM = `You are the Synthesizer in a multi-agent deliberation panel. You evaluate the discussion and determine whether a confident answer has been reached.

Use the evaluate_debate tool to record your judgment:
- Return "consensus" if the answer is solid and the Critic raised no major unresolved objections — even on round 1. Most good questions should reach consensus quickly.
- Return "continue" only if the Critic identified a substantive issue that genuinely changes the answer and another round would likely resolve it.
- Return "contested" if there is a fundamental disagreement that more rounds cannot resolve.

Bias toward consensus. The goal is a confident answer, not an extended debate.`

  const historyText = history
    .map(t => `[${t.role.toUpperCase()} - Round ${t.round}]\n${t.content}`)
    .join('\n\n---\n\n')

  const finalRoundInstruction = isFinalRound
    ? `\n\nIMPORTANT: This is the final round. You MUST produce a conclusive finalAnswer. If disagreement remains, use "contested" and summarize the strongest position alongside the key objections. Do not return "continue".`
    : ''

  const user = `Question: ${question}\n\nDiscussion so far:\n${historyText}${finalRoundInstruction}`
  return { system: SYNTHESIZER_SYSTEM, user }
}

export const SYNTHESIZER_TOOL: Anthropic.Tool[] = [
  {
    name: 'evaluate_debate',
    description: 'Record the synthesis judgment after evaluating the debate',
    input_schema: {
      type: 'object' as const,
      properties: {
        decision: {
          type: 'string',
          enum: ['consensus', 'continue', 'contested'],
          description: '"consensus" = answer is solid, no major unresolved objections. "continue" = substantive issue remains, another round would help. "contested" = fundamental disagreement more rounds cannot resolve.',
        },
        confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low', 'contested'],
          description: 'Confidence in the final answer. Use "contested" only when decision is "contested".',
        },
        reasoning: {
          type: 'string',
          description: 'One to three sentences explaining why you reached this decision.',
        },
        issuesFound: {
          type: 'number',
          description: 'How many substantive issues did the Critic raise that meaningfully changed the answer? Use 0 if the Critic agreed or only raised minor points.',
        },
        finalAnswer: {
          type: 'string',
          description: 'The synthesized final answer in clean markdown. Required for all decisions.',
        },
      },
      required: ['decision', 'confidence', 'reasoning', 'issuesFound', 'finalAnswer'],
    },
  },
]
