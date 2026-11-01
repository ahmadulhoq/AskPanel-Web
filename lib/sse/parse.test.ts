import { test } from 'node:test'
import assert from 'node:assert/strict'
import { drainSSE } from './parse.ts'

test('complete frames are returned and a partial frame is kept for the next chunk', () => {
  const first = drainSSE('data: {"a":1}\n\ndata: {"b"')
  assert.deepEqual(first.data, ['{"a":1}'])
  assert.equal(first.rest, 'data: {"b"')
  const second = drainSSE(first.rest + ':2}\n\n')
  assert.deepEqual(second.data, ['{"b":2}'])
  assert.equal(second.rest, '')
})

test('comments and blank keep-alives are ignored', () => {
  assert.deepEqual(drainSSE(': keepalive\n\ndata: x\n\n').data, ['x'])
})
