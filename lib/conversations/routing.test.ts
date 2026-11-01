import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRouting } from './routing.ts'

test('parseRouting accepts a usable convene_panel call and normalises it', () => {
  assert.deepEqual(parseRouting({ mode: 'critique', question: 'Should we hire a CFO before the Series A?', reason: 'Trade-off.' }),
    { mode: 'critique', question: 'Should we hire a CFO before the Series A?', reason: 'Trade-off.' })
  assert.equal(parseRouting({ mode: 'weird', question: 'Should we hire a CFO now?', reason: 'r' })!.mode, 'critique')
  assert.equal(parseRouting({ mode: 'critique', question: 'Hire a CFO now?', reason: '' })!.reason, 'This looks worth stress-testing.')
})

test('parseRouting adds named options to a compare question when they are not in it', () => {
  const r = parseRouting({ mode: 'compare', question: 'Which funding path should we take this year?', reason: 'r', options: ['Bootstrap', ' Seed round ', '', 7] })!
  assert.match(r.question, /Options to compare: Bootstrap; Seed round\.$/)
  const already = parseRouting({ mode: 'compare', question: 'Bootstrap or seed round this year?', reason: 'r', options: ['Bootstrap', 'seed round'] })!
  assert.equal(already.question, 'Bootstrap or seed round this year?')
})

test('parseRouting rejects unusable input', () => {
  assert.equal(parseRouting(null), null)
  assert.equal(parseRouting({ mode: 'critique', question: 'short', reason: 'r' }), null)
})
