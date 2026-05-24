import type Anthropic from '@anthropic-ai/sdk'
import type { ConversationTurn } from './types'

export interface AgentPrompt {
  system: string  // static — will be cached
  user: string    // dynamic — not cached
}

// ── Respondent ────────────────────────────────────────────────────────────────

const RESPONDENT_SYSTEM = `You are the Respondent in a multi-agent deliberation panel. Your role is to provide a thorough, well-reasoned answer.

On the first round, give a comprehensive initial answer: be specific, cite your reasoning, and acknowledge genuine uncertainty.

On subsequent rounds, you will receive a critique. Defend and refine your position — concede points where the critique is valid, push back with evidence where you disagree. Produce an improved, more nuanced answer.

Always format your response in clean markdown.`

export function buildRespondentPrompt(question: string, history: ConversationTurn[]): AgentPrompt {
  const lastCritique = [...history].reverse().find(t => t.role === 'critic')

  const user = lastCritique
    ? `Question: ${question}\n\nThe Critic raised the following points:\n${lastCritique.content}`
    : `Question: ${question}`

  return { system: RESPONDENT_SYSTEM, user }
}

// ── Critic ────────────────────────────────────────────────────────────────────

const CRITIC_SYSTEM = `You are the Critic in a multi-agent deliberation panel. Your role is quality assurance, not opposition. Your goal is the same as everyone else's: arrive at the best possible answer.

Evaluate the Respondent's answer honestly:
- If it is well-reasoned, accurate, and sufficiently complete — say so clearly. A strong answer deserves acknowledgement.
- If there are genuine gaps, unsupported claims, or missing nuance — raise them specifically and explain why they matter.
- Do NOT manufacture objections. Only raise issues that would meaningfully change the answer or the reader's confidence in it.
- If you agree overall but have a minor refinement, say that explicitly rather than framing it as a flaw.

Agreement is a valid and valuable outcome. Format your response in clean markdown.`

export function buildCriticPrompt(question: string, history: ConversationTurn[]): AgentPrompt {
  const lastRespondent = [...history].reverse().find(t => t.role === 'respondent')

  const user = `Question: ${question}\n\nThe Respondent's answer:\n${lastRespondent?.content ?? ''}`

  return { system: CRITIC_SYSTEM, user }
}

// ── Synthesizer ───────────────────────────────────────────────────────────────

const SYNTHESIZER_SYSTEM = `You are the Synthesizer in a multi-agent deliberation panel. You evaluate the discussion and determine whether a confident answer has been reached.

Use the evaluate_debate tool to record your judgment:
- Return "consensus" if the answer is solid and the Critic raised no major unresolved objections — even on round 1. Most good questions should reach consensus quickly.
- Return "continue" only if the Critic identified a substantive issue that genuinely changes the answer and another round would likely resolve it.
- Return "contested" if there is a fundamental disagreement that more rounds cannot resolve.

Bias toward consensus. The goal is a confident answer, not an extended debate.`

export function buildSynthesizerPrompt(
  question: string,
  history: ConversationTurn[],
  isFinalRound: boolean,
): AgentPrompt {
  const historyText = history
    .map(t => `[${t.role.toUpperCase()} - Round ${t.round}]\n${t.content}`)
    .join('\n\n---\n\n')

  const finalRoundInstruction = isFinalRound
    ? `\n\nIMPORTANT: This is the final round. You MUST produce a conclusive finalAnswer. If disagreement remains, use "contested" and summarize the strongest position alongside the key objections. Do not return "continue".`
    : ''

  const user = `Question: ${question}\n\nDiscussion so far:\n${historyText}${finalRoundInstruction}`

  return { system: SYNTHESIZER_SYSTEM, user }
}

// ── Synthesizer tool ──────────────────────────────────────────────────────────

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
        finalAnswer: {
          type: 'string',
          description: 'The synthesized final answer in clean markdown. Required for all decisions.',
        },
      },
      required: ['decision', 'confidence', 'reasoning', 'finalAnswer'],
    },
  },
]
