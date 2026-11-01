import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toModelMessages, debateContext, type ContextMessage } from './context.ts'

const user = (content: string): ContextMessage => ({ role: 'user', kind: 'text', content, status: 'complete', debate: null })
const reply = (content: string, status: ContextMessage['status'] = 'complete'): ContextMessage =>
  ({ role: 'assistant', kind: 'text', content, status, debate: null })
const debate = (d: ContextMessage['debate']): ContextMessage =>
  ({ role: 'assistant', kind: 'debate', content: '', status: 'complete', debate: d })

test('alternating user/assistant turns pass through in order', () => {
  assert.deepEqual(toModelMessages([user('Hi'), reply('Hello!'), user('Plan my week')]), [
    { role: 'user', content: 'Hi' },
    { role: 'assistant', content: 'Hello!' },
    { role: 'user', content: 'Plan my week' },
  ])
})

test('debate verdicts become assistant turns the model can build on', () => {
  const msgs = toModelMessages([
    user('Should we raise?'),
    debate({ status: 'complete', finalAnswer: 'Raise a small round.', confidence: 'high' }),
    user('How much?'),
  ])
  assert.equal(msgs[1].role, 'assistant')
  assert.match(msgs[1].content, /Panel verdict.*high/)
  assert.match(msgs[1].content, /Raise a small round\./)
})

test('a running or failed debate is described, not invented', () => {
  const running = toModelMessages([user('Q'), debate({ status: 'running', finalAnswer: null, confidence: null }), user('meanwhile?')])
  assert.match(running[1].content, /still running/)
  const failed = toModelMessages([user('Q'), debate({ status: 'error', finalAnswer: null, confidence: null }), user('again?')])
  assert.match(failed[1].content, /failed/)
})

test('consecutive same-role turns merge and failed empty replies are dropped', () => {
  const msgs = toModelMessages([user('a'), reply('', 'error'), user('b')])
  assert.deepEqual(msgs, [{ role: 'user', content: 'a\n\nb' }])
})

test('history is trimmed from the oldest end and always starts with a user turn', () => {
  const long = 'x'.repeat(100)
  const msgs = toModelMessages([user(long), reply(long), user(long), reply(long), user('latest')], 250)
  assert.equal(msgs.at(-1)!.content, 'latest')
  assert.equal(msgs[0].role, 'user')
  assert.ok(msgs.reduce((n, m) => n + m.content.length, 0) <= 250)
})

test('debate context summarises prior turns within budget, newest kept', () => {
  assert.equal(debateContext([]), null)
  const ctx = debateContext([
    user('We have $200k runway'),
    reply('That is about 8 months.'),
    debate({ status: 'complete', finalAnswer: 'Cut burn first.', confidence: 'medium' }),
  ])!
  assert.match(ctx, /Earlier in this conversation/)
  assert.match(ctx, /User: We have \$200k runway/)
  assert.match(ctx, /Panel verdict: Cut burn first\./)
  const trimmed = debateContext([user('old '.repeat(200)), user('recent fact')], 120)!
  assert.match(trimmed, /recent fact/)
  assert.doesNotMatch(trimmed, /old old/)
})
