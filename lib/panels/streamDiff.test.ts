import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newCursor, diffPanel, type PanelView } from './streamDiff.ts'

const view = (over: Partial<PanelView>): PanelView => ({
  status: 'running',
  rounds: [],
  live: null,
  finalAnswer: null,
  confidence: null,
  errorMessage: null,
  ...over,
})

const r1Done = {
  roundNumber: 1,
  respondent: { content: 'R1' },
  critic: { content: 'C1' },
  synthesizer: { decision: 'consensus' as const, confidence: 'high' as const, reasoning: 'agree', issuesFound: 2 },
}

test('a completed panel replays every step then completes', () => {
  const cursor = newCursor()
  const events = diffPanel(cursor, view({ status: 'complete', rounds: [r1Done], finalAnswer: 'FA', confidence: 'high' }))
  assert.deepEqual(events.map(e => e.type), [
    'agent_start', 'agent_complete', 'agent_start', 'agent_complete',
    'synthesis_start', 'synthesis_result', 'panel_complete',
  ])
  assert.equal(cursor.done, true)
  assert.deepEqual(events.at(-1), { type: 'panel_complete', finalAnswer: 'FA', confidence: 'high' })
})

test('live text streams as deltas and completes without a second start', () => {
  const cursor = newCursor()
  const live = (content: string) => ({ agent: 'respondent' as const, round: 1, content, runId: 'a' })

  assert.deepEqual(diffPanel(cursor, view({ live: live('Hel') })), [
    { type: 'agent_start', agent: 'respondent', round: 1 },
    { type: 'agent_token', agent: 'respondent', token: 'Hel' },
  ])
  assert.deepEqual(diffPanel(cursor, view({ live: live('Hello') })), [
    { type: 'agent_token', agent: 'respondent', token: 'lo' },
  ])
  const stored = [{ roundNumber: 1, respondent: { content: 'Hello!' }, critic: null, synthesizer: null }]
  assert.deepEqual(diffPanel(cursor, view({ rounds: stored, live: live('Hello') })), [
    { type: 'agent_complete', agent: 'respondent', round: 1, content: 'Hello!' },
  ])
})

test('a restarted turn re-sends agent_start and the full text', () => {
  const cursor = newCursor()
  diffPanel(cursor, view({ live: { agent: 'critic', round: 1, content: 'long partial text', runId: 'a' } }))
  assert.deepEqual(diffPanel(cursor, view({ live: { agent: 'critic', round: 1, content: 'Re', runId: 'b' } })), [
    { type: 'agent_start', agent: 'critic', round: 1 },
    { type: 'agent_token', agent: 'critic', token: 'Re' },
  ])
})

test('the same snapshot twice emits nothing the second time', () => {
  const cursor = newCursor()
  const snap = view({ rounds: [{ ...r1Done, synthesizer: null }], live: { agent: 'critic', round: 1, content: 'C1', runId: 'a' } })
  assert.ok(diffPanel(cursor, snap).length > 0)
  assert.deepEqual(diffPanel(cursor, snap), [])
})

test('a queued panel with no progress emits nothing; an error ends the stream', () => {
  const cursor = newCursor()
  assert.deepEqual(diffPanel(cursor, view({ status: 'queued' })), [])
  assert.deepEqual(diffPanel(cursor, view({ status: 'error', errorMessage: 'boom' })), [{ type: 'error', message: 'boom' }])
  assert.equal(cursor.done, true)
  assert.deepEqual(diffPanel(cursor, view({ status: 'error', errorMessage: 'boom' })), [])
})

test('compare mode: stored proposals and critic replay in order, then the judge, then completion', () => {
  const judgement = { winner: 2, scores: [{ option: 1, score: 6, summary: 'a' }, { option: 2, score: 8, summary: 'b' }], reasoning: 'r', confidence: 'high' as const }
  const events = diffPanel(newCursor(), view({
    mode: 'compare', status: 'complete', finalAnswer: 'Pick 2', confidence: 'high',
    compare: { proposals: [{ content: 'P1' }, { content: 'P2' }], critic: { content: 'C' }, judgement },
  }))
  assert.deepEqual(events.map((e) => e.type + ('index' in e && e.index !== undefined ? `:${e.index}` : '')), [
    'agent_start:0', 'agent_complete:0', 'agent_start:1', 'agent_complete:1', 'agent_start', 'agent_complete',
    'synthesis_start', 'compare_result', 'panel_complete',
  ])
  assert.equal((events.at(-2) as { winner: number }).winner, 2)
})

test('compare mode: live proposer text streams, then completes without a second start', () => {
  const cursor = newCursor()
  const live = { agent: 'proposer' as const, round: 1, index: 1, content: 'Hel', runId: 'r1' }
  const first = diffPanel(cursor, view({ mode: 'compare', compare: { proposals: [{ content: 'P1' }], critic: null, judgement: null }, live }))
  assert.deepEqual(first.map((e) => e.type), ['agent_start', 'agent_complete', 'agent_start', 'agent_token'])
  assert.equal((first[2] as { index?: number }).index, 1)
  const more = diffPanel(cursor, view({ mode: 'compare', compare: { proposals: [{ content: 'P1' }], critic: null, judgement: null }, live: { ...live, content: 'Hello' } }))
  assert.deepEqual(more, [{ type: 'agent_token', agent: 'proposer', index: 1, token: 'lo' }])
  const done = diffPanel(cursor, view({ mode: 'compare', compare: { proposals: [{ content: 'P1' }, { content: 'Hello!' }], critic: null, judgement: null }, live: null }))
  assert.deepEqual(done, [{ type: 'agent_complete', agent: 'proposer', round: 1, index: 1, content: 'Hello!' }])
})


test('compare mode: Pro revisions stream as round-2 proposer turns, then the judge', () => {
  const cursor = newCursor()
  const base = { options: ['A', 'B'], proposals: [{ content: 'P1' }, { content: 'P2' }], critic: { content: 'C' }, revise: true, judgement: null }
  const live = { agent: 'proposer' as const, round: 2, index: 0, content: 'R', runId: 'r1' }
  const first = diffPanel(cursor, view({ mode: 'compare', compare: { ...base, revisions: [] }, live }))
  // Round-1 proposer 0 is stored; the live round-2 turn for the same proposer is separate.
  assert.deepEqual(first.slice(-2).map((e) => [e.type, 'round' in e ? e.round : undefined]), [['agent_start', 2], ['agent_token', undefined]])
  const done = diffPanel(cursor, view({ mode: 'compare', compare: { ...base, revisions: [{ content: 'R1' }] }, live: null }))
  assert.deepEqual(done, [{ type: 'agent_complete', agent: 'proposer', round: 2, index: 0, content: 'R1' }])
  const judgement = { winner: 1, scores: [], reasoning: 'r', confidence: 'high' as const }
  const end = diffPanel(cursor, view({
    mode: 'compare', status: 'complete', finalAnswer: 'Pick 1', confidence: 'high',
    compare: { ...base, revisions: [{ content: 'R1' }, { content: 'R2' }], judgement },
  }))
  assert.deepEqual(end.map((e) => e.type + ('round' in e ? `:${e.round}` : '')), ['agent_start:2', 'agent_complete:2', 'synthesis_start:2', 'compare_result', 'panel_complete'])
})

test('compare mode: the judge shows as weighing only once everything it needs is stored', () => {
  const cursor = newCursor()
  const proposals = [{ content: 'P1' }, { content: 'P2' }, { content: 'P3' }]
  // Pro: the critique is in but revisions are still to come — not the judge's turn yet.
  const early = diffPanel(cursor, view({ mode: 'compare', compare: { proposals, critic: { content: 'C' }, revise: true, revisions: [], judgement: null } }))
  assert.equal(early.some((e) => e.type === 'synthesis_start'), false)
  const ready = diffPanel(cursor, view({ mode: 'compare', compare: { proposals, critic: { content: 'C' }, revise: true, revisions: proposals, judgement: null } }))
  assert.deepEqual(ready.filter((e) => e.type === 'synthesis_start'), [{ type: 'synthesis_start', round: 2 }])
  const judgement = { winner: 1, scores: [], reasoning: 'r', confidence: 'high' as const }
  const end = diffPanel(cursor, view({ mode: 'compare', status: 'complete', finalAnswer: 'A', confidence: 'high', compare: { proposals, critic: { content: 'C' }, revise: true, revisions: proposals, judgement } }))
  assert.deepEqual(end.map((e) => e.type), ['compare_result', 'panel_complete'], 'no second synthesis_start')
})
