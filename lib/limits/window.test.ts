import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide, type WindowState } from './window.ts'

const limit = { max: 3, windowMs: 60_000 }

test('counts up to the limit within a window, then refuses with the time left', () => {
  let state: WindowState | null = null
  for (let i = 1; i <= 3; i++) {
    const d = decide(state, limit, 1_000 + i)
    assert.equal(d.allowed, true)
    if (d.allowed) state = d.next
  }
  assert.deepEqual(state, { count: 3, windowStart: 1_001 })
  const refused = decide(state, limit, 31_001)
  assert.deepEqual(refused, { allowed: false, retryAfterMs: 30_000 })
})

test('a new window starts once the old one has passed', () => {
  const d = decide({ count: 3, windowStart: 0 }, limit, 60_000)
  assert.deepEqual(d, { allowed: true, next: { count: 1, windowStart: 60_000 } })
})

test('a window start in the future (clock skew) is treated as expired', () => {
  const d = decide({ count: 3, windowStart: 100_000 }, limit, 50_000)
  assert.equal(d.allowed, true)
})
