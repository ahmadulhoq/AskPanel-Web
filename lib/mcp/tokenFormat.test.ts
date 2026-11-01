import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bearerToken, hashToken, isTokenShaped, newToken, tokenHint } from './tokenFormat.ts'

test('tokens are well-formed, unique and only their hash is stable', () => {
  const a = newToken()
  const b = newToken()
  assert.ok(isTokenShaped(a) && isTokenShaped(b) && a !== b)
  assert.equal(hashToken(a), hashToken(a))
  assert.notEqual(hashToken(a), hashToken(b))
  assert.equal(hashToken(a).length, 64)
  assert.match(tokenHint(a), /^ap_.{4}…$/)
})

test('bearerToken accepts only a well-formed bearer token', () => {
  const t = newToken()
  assert.equal(bearerToken(`Bearer ${t}`), t)
  assert.equal(bearerToken(`bearer   ${t} `), t)
  assert.equal(bearerToken(t), null)
  assert.equal(bearerToken('Bearer ap_short'), null)
  assert.equal(bearerToken(null), null)
})
