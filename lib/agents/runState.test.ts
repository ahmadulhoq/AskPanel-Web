import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resumePoint, historyBefore } from './runState.ts'
import type { PanelRound, RoundSynthesis } from '@/types'

const synth = (decision: RoundSynthesis['decision']): RoundSynthesis =>
  ({ decision, confidence: 'medium', reasoning: `synth:${decision}`, issuesFound: 0 })

const round = (n: number, parts: Partial<Omit<PanelRound, 'roundNumber'>>): PanelRound => ({
  roundNumber: n,
  respondent: null,
  critic: null,
  synthesizer: null,
  ...parts,
})

const resp = (n: number) => ({ content: `respondent ${n}` })
const crit = (n: number) => ({ content: `critic ${n}` })

test('fresh panel starts at round 1 respondent', () => {
  assert.deepEqual(resumePoint([], 2), { round: 1, step: 'respondent' })
  assert.deepEqual(historyBefore([], { round: 1, step: 'respondent' }), [])
})

test('resumes at the first missing step of the last round', () => {
  assert.deepEqual(resumePoint([round(1, { respondent: resp(1) })], 2), { round: 1, step: 'critic' })
  assert.deepEqual(
    resumePoint([round(1, { respondent: resp(1), critic: crit(1) })], 2),
    { round: 1, step: 'synthesizer' },
  )
})

test('a completed round that voted continue moves to the next round', () => {
  const rounds = [round(1, { respondent: resp(1), critic: crit(1), synthesizer: synth('continue') })]
  const point = resumePoint(rounds, 2)
  assert.deepEqual(point, { round: 2, step: 'respondent' })
  assert.deepEqual(historyBefore(rounds, point).map(t => t.role), ['respondent', 'critic', 'synthesizer'])
})

test('a finished verdict re-runs the last synthesis to recover the final answer', () => {
  // The final answer is only stored at completion, so a crash after the last synthesis
  // must re-run that synthesis rather than finishing with no answer.
  const rounds = [round(1, { respondent: resp(1), critic: crit(1), synthesizer: synth('consensus') })]
  const point = resumePoint(rounds, 2)
  assert.deepEqual(point, { round: 1, step: 'synthesizer' })
  assert.deepEqual(historyBefore(rounds, point).map(t => t.content), ['respondent 1', 'critic 1'])
})

test('continue on the final round re-runs that synthesis instead of adding a round', () => {
  const rounds = [
    round(1, { respondent: resp(1), critic: crit(1), synthesizer: synth('continue') }),
    round(2, { respondent: resp(2), critic: crit(2), synthesizer: synth('continue') }),
  ]
  assert.deepEqual(resumePoint(rounds, 2), { round: 2, step: 'synthesizer' })
})

test('history keeps earlier rounds in order regardless of storage order', () => {
  const rounds = [
    round(2, { respondent: resp(2) }),
    round(1, { respondent: resp(1), critic: crit(1), synthesizer: synth('continue') }),
  ]
  const point = resumePoint(rounds, 3)
  assert.deepEqual(point, { round: 2, step: 'critic' })
  assert.deepEqual(
    historyBefore(rounds, point).map(t => `${t.role}${t.round}`),
    ['respondent1', 'critic1', 'synthesizer1', 'respondent2'],
  )
})
