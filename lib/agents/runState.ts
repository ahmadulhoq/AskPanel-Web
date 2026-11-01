import type { ConfidenceLevel, PanelRound, SynthesisDecision } from '@/types'
import type { ConversationTurn } from './types'

export type Synthesis = {
  decision: SynthesisDecision
  confidence: ConfidenceLevel
  reasoning: string
  issuesFound: number
  finalAnswer: string
}

const DECISIONS: SynthesisDecision[] = ['consensus', 'continue', 'contested']
const CONFIDENCE: ConfidenceLevel[] = ['high', 'medium', 'low', 'contested']

// The Synthesizer's tool input, checked and normalised: a known decision and a non-empty
// final answer are required; confidence falls back to medium, issuesFound to 0. Returns
// null if unusable (e.g. a tool call cut off mid-input).
export function parseSynthesis(input: unknown): Synthesis | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>
  if (!DECISIONS.includes(o.decision as SynthesisDecision)) return null
  const finalAnswer = typeof o.finalAnswer === 'string' ? o.finalAnswer.trim() : ''
  if (!finalAnswer) return null
  const issues = Math.trunc(Number(o.issuesFound))
  return {
    decision: o.decision as SynthesisDecision,
    confidence: CONFIDENCE.includes(o.confidence as ConfidenceLevel) ? (o.confidence as ConfidenceLevel) : 'medium',
    reasoning: typeof o.reasoning === 'string' ? o.reasoning.trim() : '',
    issuesFound: Number.isFinite(issues) && issues > 0 ? issues : 0,
    finalAnswer,
  }
}

export type RunStep = 'respondent' | 'critic' | 'synthesizer'

export interface ResumePoint {
  round: number
  step: RunStep
}

const byRound = (rounds: PanelRound[]) => [...rounds].sort((a, b) => a.roundNumber - b.roundNumber)

// Where an interrupted run should pick up, given the steps already stored.
export function resumePoint(rounds: PanelRound[], maxRounds: number): ResumePoint {
  const sorted = byRound(rounds).filter(r => r.roundNumber >= 1 && r.roundNumber <= maxRounds)
  const last = sorted.at(-1)
  if (!last) return { round: 1, step: 'respondent' }
  if (!last.respondent) return { round: last.roundNumber, step: 'respondent' }
  if (!last.critic) return { round: last.roundNumber, step: 'critic' }
  if (!last.synthesizer) return { round: last.roundNumber, step: 'synthesizer' }
  if (last.synthesizer.decision === 'continue' && last.roundNumber < maxRounds) {
    return { round: last.roundNumber + 1, step: 'respondent' }
  }
  // The verdict's final answer is only persisted at completion, so re-run the last synthesis.
  return { round: last.roundNumber, step: 'synthesizer' }
}

// The conversation the agents had seen before `point`, rebuilt from stored rounds.
export function historyBefore(rounds: PanelRound[], point: ResumePoint): ConversationTurn[] {
  const history: ConversationTurn[] = []
  for (const r of byRound(rounds)) {
    const n = r.roundNumber
    if (n > point.round) break
    const current = n === point.round
    if (r.respondent && (!current || point.step !== 'respondent')) {
      history.push({ role: 'respondent', content: r.respondent.content, round: n })
    }
    if (r.critic && (!current || point.step === 'synthesizer')) {
      history.push({ role: 'critic', content: r.critic.content, round: n })
    }
    if (r.synthesizer && !current) {
      history.push({ role: 'synthesizer', content: r.synthesizer.reasoning, round: n })
    }
  }
  return history
}

// Whether round 1 has its verdict. A free run stopped before this point is refunded (spec §3.3).
export const firstRoundComplete = (rounds: PanelRound[]) =>
  rounds.some(r => r.roundNumber === 1 && !!r.synthesizer)
