import type { PanelRound } from '@/types'
import type { ConversationTurn } from './types'

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
