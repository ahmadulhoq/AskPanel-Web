import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compareResumePoint, compareRunCounts, emptyCompare, finalProposals, optionName, parseJudgement, PROPOSER_COUNT, sanitizeOptions } from './compareState.ts'

test('compareResumePoint walks proposers, then critic, then judge', () => {
  assert.deepEqual(compareResumePoint(null), { step: 'proposer', index: 0 })
  assert.deepEqual(compareResumePoint({ proposals: [{ content: 'a' }], critic: null, judgement: null }), { step: 'proposer', index: 1 })
  const all = Array.from({ length: PROPOSER_COUNT }, () => ({ content: 'x' }))
  assert.deepEqual(compareResumePoint({ proposals: all, critic: null, judgement: null }), { step: 'critic' })
  assert.deepEqual(compareResumePoint({ proposals: all, critic: { content: 'c' }, judgement: null }), { step: 'judge' })
})

test('optionName takes the first heading and drops an "Option N:" label', () => {
  assert.equal(optionName('## Option 2: Bootstrap for a year\n\nBody', 'Option 2'), 'Bootstrap for a year')
  assert.equal(optionName('### **Raise a seed round**\nmore', 'Option 1'), 'Raise a seed round')
  assert.equal(optionName('No heading here', 'Option 3'), 'Option 3')
})

test('parseJudgement validates the winner and normalises scores', () => {
  const ok = parseJudgement({
    winner: 2, confidence: 'high', reasoning: 'r', finalAnswer: 'Go with 2.',
    scores: [{ option: 2, score: 8.6, summary: 'b' }, { option: 1, score: 14, summary: 'a' }, { option: 1, score: 3 }, { option: 9, score: 5 }],
  }, 3)!
  assert.equal(ok.winner, 2)
  assert.deepEqual(ok.scores, [{ option: 1, score: 10, summary: 'a' }, { option: 2, score: 9, summary: 'b' }])
  assert.equal(parseJudgement({ winner: 4, finalAnswer: 'x' }, 3), null)
  assert.equal(parseJudgement({ winner: 1, finalAnswer: '' }, 3), null)
  assert.equal(parseJudgement({ winner: 1, finalAnswer: 'x', confidence: 'sure' }, 3)!.confidence, 'medium')
})

test('compareRunCounts: a compare run counts once all its options are in', () => {
  assert.equal(compareRunCounts(null), false)
  assert.equal(compareRunCounts({ proposals: [{ content: 'a' }, { content: 'b' }], critic: null, judgement: null }), false)
  assert.equal(compareRunCounts({ proposals: Array.from({ length: PROPOSER_COUNT }, () => ({ content: 'x' })), critic: null, judgement: null }), true)
})


test('sanitizeOptions: 2–3 distinct, trimmed options, or none', () => {
  assert.deepEqual(sanitizeOptions(['  Bootstrap ', 'Raise a seed', 'Take a loan']), ['Bootstrap', 'Raise a seed', 'Take a loan'])
  assert.deepEqual(sanitizeOptions(['A', 'a', 'B', '', 7, 'C', 'D']), ['A', 'B', 'C'], 'case-insensitive duplicates, non-strings and extras dropped')
  assert.equal(sanitizeOptions(['Only one']), null)
  assert.equal(sanitizeOptions(['A', '   ']), null)
  assert.equal(sanitizeOptions('A, B'), null)
  assert.equal(sanitizeOptions(['x'.repeat(500), 'B'])![0].length, 200)
})

test('user options set the proposer count; revisions come after the critic', () => {
  const two = { ...emptyCompare(['A', 'B'], true) }
  assert.deepEqual(compareResumePoint(two), { step: 'proposer', index: 0 })
  two.proposals = [{ content: 'a' }, { content: 'b' }]
  assert.deepEqual(compareResumePoint(two), { step: 'critic' })
  assert.equal(compareRunCounts(two), true, 'two of two options are in')
  two.critic = { content: 'c' }
  assert.deepEqual(compareResumePoint(two), { step: 'revision', index: 0 })
  two.revisions = [{ content: 'a2' }]
  assert.deepEqual(compareResumePoint(two), { step: 'revision', index: 1 })
  two.revisions.push({ content: 'b2' })
  assert.deepEqual(compareResumePoint(two), { step: 'judge' })
  assert.deepEqual(finalProposals(two), ['a2', 'b2'], 'the judge sees the revised options')
  const noRevise = { ...emptyCompare(), proposals: [{ content: 'a' }, { content: 'b' }, { content: 'c' }], critic: { content: 'c' } }
  assert.deepEqual(compareResumePoint(noRevise), { step: 'judge' })
  assert.deepEqual(finalProposals(noRevise), ['a', 'b', 'c'])
})
