import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toModelMessages, debateContext, summaryBacklog, REPLY_WINDOW_MESSAGES, type ContextMessage } from './context.ts'

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
  assert.match(ctx, /Panel verdict \(confidence: medium\): Cut burn first\./)
  const trimmed = debateContext([user('old '.repeat(200)), user('recent fact')], 120)!
  assert.match(trimmed, /recent fact/)
  assert.doesNotMatch(trimmed, /old old/)
})

test('a stopped debate is described as stopped, not failed', () => {
  const msgs = toModelMessages([user('Q'), debate({ status: 'error', finalAnswer: null, confidence: null, stopped: true }), user('ok')])
  assert.match(msgs[1].content, /stopped/)
})

test('the rolling summary opens the first user turn and counts against the budget', () => {
  const msgs = toModelMessages([reply('dangling'), user('Next question')], 24_000, 'They run a bakery.')
  assert.equal(msgs.length, 1)
  assert.equal(msgs[0].role, 'user')
  assert.match(msgs[0].content, /^\[Summary of the earlier conversation\]\nThey run a bakery\.\n\nNext question$/)

  const long = 'x'.repeat(90)
  const budgeted = toModelMessages([user(long), reply(long), user('newest')], 200, 's'.repeat(60))
  assert.equal(budgeted.length, 1, 'summary length leaves room only for the newest turn')
})

const seqd = (m: ContextMessage, seq: number) => ({ ...m, seq })

test('summaryBacklog: nothing while everything fits the reply window', () => {
  const history = [user('a'), reply('b'), user('c')].map(seqd)
  assert.deepEqual(summaryBacklog(history, 0), [])
})

test('summaryBacklog: messages pushed out by the character budget, once there are enough', () => {
  const big = 'y'.repeat(2_000)
  const history = Array.from({ length: 6 }, (_, i) => seqd(i % 2 ? reply(big) : user(big), i + 1))
  // Budget fits the newest two messages: the oldest four (8k chars) are the backlog.
  const backlog = summaryBacklog(history, 0, 4_500)
  assert.deepEqual(backlog.map((m) => m.seq), [1, 2, 3, 4])
  // Already summarized through seq 2 → only 3 and 4 remain (4k chars, still enough).
  assert.deepEqual(summaryBacklog(history, 2, 4_500).map((m) => m.seq), [3, 4])
  // Through seq 3 → 2k chars left, below the threshold: wait for more.
  assert.deepEqual(summaryBacklog(history, 3, 4_500), [])
})

test('summaryBacklog: messages beyond the message-count window count too', () => {
  const history = Array.from({ length: REPLY_WINDOW_MESSAGES + 30 }, (_, i) =>
    seqd(i % 2 ? reply('z'.repeat(150)) : user('z'.repeat(150)), i + 1))
  const backlog = summaryBacklog(history, 0)
  assert.equal(backlog.length, 30)
  assert.equal(backlog.at(-1)!.seq, 30)
})

test('debate context leads with the rolling summary, capped at half the budget', () => {
  const ctx = debateContext([user('recent fact')], 400, 'S'.repeat(1_000))!
  assert.match(ctx, /Summary: S+…/)
  assert.ok(ctx.length <= 400)
  assert.match(ctx, /recent fact/)
  assert.match(debateContext([], 400, 'short summary')!, /Summary: short summary/)
})

