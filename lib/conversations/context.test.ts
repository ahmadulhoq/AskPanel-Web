import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toModelMessages, debateContext, summaryBacklog, replyHistory, REPLY_WINDOW_MESSAGES, type ContextMessage } from './context.ts'

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

test('the rolling summary opens the first user turn without shrinking the message budget', () => {
  const msgs = toModelMessages([reply('dangling'), user('Next question')], 24_000, 'They run a bakery.')
  assert.equal(msgs.length, 1)
  assert.equal(msgs[0].role, 'user')
  assert.match(msgs[0].content, /^\[Summary of the earlier conversation\]\nThey run a bakery\.\n\nNext question$/)

  const long = 'x'.repeat(90)
  const withSummary = toModelMessages([user(long), reply(long), user('newest')], 200, 's'.repeat(500))
  const without = toModelMessages([user(long), reply(long), user('newest')], 200)
  assert.equal(withSummary.length, without.length, 'same messages kept with or without a summary')
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

test('summaryBacklog: many short messages trigger too', () => {
  const history = Array.from({ length: REPLY_WINDOW_MESSAGES + 8 }, (_, i) => seqd(i % 2 ? reply('ok') : user('hi'), i + 1))
  assert.equal(summaryBacklog(history, 0).length, 8)
  assert.deepEqual(summaryBacklog(history.slice(1), 0), [], '7 short messages: wait for more')
})

test('replyHistory: what is not summarized yet, window plus slack', () => {
  const history = Array.from({ length: 100 }, (_, i) => seqd(user(`m${i}`), i + 1))
  const seen = replyHistory(history, 10)
  assert.equal(seen[0].seq, 100 - (REPLY_WINDOW_MESSAGES + 8) + 1)
  assert.equal(replyHistory(history.slice(0, 20), 10)[0].seq, 11)
})

test('summaryBacklog: messages beyond the message-count window count too', () => {
  const history = Array.from({ length: REPLY_WINDOW_MESSAGES + 30 }, (_, i) =>
    seqd(i % 2 ? reply('z'.repeat(150)) : user('z'.repeat(150)), i + 1))
  const backlog = summaryBacklog(history, 0)
  assert.equal(backlog.length, 30)
  assert.equal(backlog.at(-1)!.seq, 30)
})

test('summaryBacklog and the reply agree: unsummarized messages left of the window are still replied to', () => {
  const big = 'w'.repeat(2_000)
  // 13 messages × 2k: the 24k window holds 12, one message (2k, below the trigger) is left over.
  const history = Array.from({ length: 13 }, (_, i) => seqd(i % 2 ? reply(big) : user(big), i + 1))
  assert.deepEqual(summaryBacklog(history, 0), [])
  const msgs = toModelMessages(replyHistory(history, 0), 24_000 + 3_000)
  assert.equal(msgs.reduce((n, m) => n + m.content.length, 0) >= 13 * 2_000, true)
})

test('debate context leads with the rolling summary, capped at half the budget', () => {
  const ctx = debateContext([user('recent fact')], 400, 'S'.repeat(1_000))!
  assert.match(ctx, /Summary: S+…/)
  assert.ok(ctx.length <= 400)
  assert.match(ctx, /recent fact/)
  assert.match(debateContext([], 400, 'short summary')!, /Summary: short summary/)
})

test('an open debate proposal is described to the model, not dropped', () => {
  const proposal: ContextMessage = { role: 'assistant', kind: 'debate_proposal', content: '', status: 'complete', debate: null }
  const msgs = toModelMessages([user('Should we hire a CFO?'), proposal, user('Actually, what does a CFO cost?')])
  assert.equal(msgs.length, 3)
  assert.match(msgs[1].content, /not run it/)
})

test('context the user attached travels with their message', () => {
  const withContext: ContextMessage = { ...user('Review my pitch'), context: 'Deck: 12 slides, seed round.' }
  assert.match(toModelMessages([withContext])[0].content, /Review my pitch\n\n\[Context the user attached\]\nDeck: 12 slides/)
  assert.match(debateContext([withContext])!, /User: Review my pitch[\s\S]*Deck: 12 slides/)
})

