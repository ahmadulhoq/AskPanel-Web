import { test } from 'node:test'
import assert from 'node:assert/strict'
import { panelReducer, initialPanelState } from './panelState.ts'
import { stateFromPanel as replay } from './replay.ts'

test('a stored compare panel replays into proposer turns, critic, comparison and answer', () => {
  const judgement = { winner: 1, scores: [{ option: 1, score: 9, summary: 'a' }], reasoning: 'r', confidence: 'medium' as const }
  const state = replay({
    mode: 'compare', status: 'complete', rounds: [], live: null, errorMessage: null,
    finalAnswer: 'Pick 1', confidence: 'medium',
    compare: { proposals: [{ content: 'P1' }, { content: 'P2' }, { content: 'P3' }], critic: { content: 'C' }, judgement },
  })
  assert.deepEqual(state.turns.map((t) => [t.agent, t.index, t.content, t.streaming]), [
    ['proposer', 0, 'P1', false], ['proposer', 1, 'P2', false], ['proposer', 2, 'P3', false], ['critic', undefined, 'C', false],
  ])
  assert.deepEqual(state.comparison, judgement)
  assert.equal(state.status, 'complete')
  assert.equal(state.finalAnswer, 'Pick 1')
})

test('consecutive proposers each get their own turn, even when replayed live', () => {
  let state = initialPanelState()
  for (const e of [
    { type: 'agent_start', agent: 'proposer', round: 1, index: 0 },
    { type: 'agent_token', agent: 'proposer', index: 0, token: 'A' },
    { type: 'agent_complete', agent: 'proposer', round: 1, index: 0, content: 'A!' },
    { type: 'agent_start', agent: 'proposer', round: 1, index: 1 },
    { type: 'agent_token', agent: 'proposer', index: 1, token: 'B' },
  ] as const) state = panelReducer(state, e)
  assert.deepEqual(state.turns.map((t) => [t.index, t.content, t.streaming]), [[0, 'A!', false], [1, 'B', true]])
})

test('a token goes only to its own proposer, even if two are marked streaming', () => {
  let state = initialPanelState()
  for (const e of [
    { type: 'agent_start', agent: 'proposer', round: 1, index: 0 },
    { type: 'agent_start', agent: 'proposer', round: 1, index: 1 },
    { type: 'agent_token', agent: 'proposer', index: 1, token: 'B' },
  ] as const) state = panelReducer(state, e)
  assert.deepEqual(state.turns.map((t) => t.content), ['', 'B'])
})
