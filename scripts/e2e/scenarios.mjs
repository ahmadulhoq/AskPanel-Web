// Integration scenarios for background debate runs, against the Firestore emulator and
// the fake model API. Run via scripts/e2e/run.sh (needs: node --import ./register.mjs).
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { pathToFileURL, fileURLToPath } from 'node:url'
import path from 'node:path'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../..')
const FAKE = `http://127.0.0.1:${process.env.FAKE_ANTHROPIC_PORT ?? 8099}`
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href)
const { adminDb } = await imp('lib/firebase/admin.ts')
const { runPanelJob } = await imp('lib/agents/runner.ts')
const { newCursor, diffPanel } = await imp('lib/panels/streamDiff.ts')
const { reserveRun, refundRun, FreeLimitReachedError } = await imp('lib/billing/runs.ts')
const { DEFAULT_MODEL } = await imp('lib/anthropic.ts')
const { stopPanel, StopRejected } = await imp('lib/panels/stop.ts')
const { STOPPED_MESSAGE } = await imp('lib/panels/constants.ts')
const { createPanel } = await imp('lib/panels/create.ts')
const { updateSummary } = await imp('lib/conversations/summary.ts')
const { loadMessages } = await imp('lib/conversations/store.ts')
const { rateLimit, RateLimitedError, LIMITS } = await imp('lib/limits/rateLimit.ts')
const { deletePanel } = await imp('lib/panels/delete.ts')
const { deleteAccount } = await imp('lib/account/delete.ts')
const { listPanels, PANEL_PAGE_SIZE } = await imp('lib/panels/list.ts')
const { adminAuth } = await imp('lib/firebase/admin.ts')
const { migrateUserPanels } = await imp('lib/conversations/migrate.ts')
const { listConversations } = await imp('lib/conversations/list.ts')
const { Timestamp } = await import(pathToFileURL(createRequire(path.join(ROOT, 'package.json')).resolve('firebase-admin/firestore')).href)

const db = adminDb()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const fake = async (p, body) => (await fetch(FAKE + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body) })).json()
const panel = async (id) => (await db.collection('panels').doc(id).get()).data()
const user = async (id) => (await db.collection('users').doc(id).get()).data()
const until = async (pred, label, ms = 30000) => {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) { if (await pred()) return; await sleep(100) }
  throw new Error('timed out waiting for ' + label)
}
const makeUser = (uid, tier, used, resetAt = Date.now() + 86400000) =>
  db.collection('users').doc(uid).set({ freeRunsUsed: used, freeRunsResetAt: Timestamp.fromMillis(resetAt), subscription: { tier } })
const makePanel = (id, uid, extra = {}) => db.collection('panels').doc(id).set({
  userId: uid, question: 'Should we raise a seed round now?', persona: 'general', customPersona: null,
  context: null, status: 'queued', config: { maxRounds: 2, model: 'claude-sonnet-4-5' }, rounds: [],
  finalAnswer: null, confidence: null, errorMessage: null, title: null, ...extra,
})
// Same pipeline the stream route uses: Firestore snapshots → diffPanel → SSE events.
const watch = (id) => {
  const cursor = newCursor(); const events = []
  let resolve; const done = new Promise((r) => (resolve = r))
  const unsub = db.collection('panels').doc(id).onSnapshot((d) => {
    events.push(...diffPanel(cursor, d.data())); if (cursor.done) { unsub(); resolve() }
  })
  return { events, done, stop: unsub }
}
const count = (events, type, agent) => events.filter((e) => e.type === type && (!agent || e.agent === agent)).length

const results = []
async function scenario(name, fn) {
  await fake('/__reset', {})
  try { await fn(); results.push(['PASS', name]) } catch (e) { results.push(['FAIL', name, e.message]) }
}

await scenario('1. happy path: run completes, viewer gets the full event sequence', async () => {
  await fake('/__control', { tokenDelayMs: 100 }) // 2.5s turns, longer than the 1s flush window
  await makeUser('u1', 'free', 1); await makePanel('p1', 'u1', { runCounted: true })
  const w = watch('p1')
  await runPanelJob('p1'); await w.done
  const p = await panel('p1')
  assert.equal(p.status, 'complete'); assert.match(p.finalAnswer, /^## Verdict/)
  assert.equal(p.run, null); assert.equal(p.live, null); assert.equal(p.title, 'Harness Panel Title')
  assert.equal(p.config.model, DEFAULT_MODEL, 'runner records the model it actually used')
  const types = w.events.map((e) => e.type)
  assert.equal(types[0], 'agent_start'); assert.equal(types.at(-1), 'panel_complete')
  const tokens = w.events.filter((e) => e.type === 'agent_token' && e.agent === 'respondent')
  assert.ok(tokens.length >= 1, 'live text streamed before completion')
  const completed = w.events.find((e) => e.type === 'agent_complete' && e.agent === 'respondent').content
  assert.ok(completed.startsWith(tokens.map((t) => t.token).join('')), 'streamed deltas are a prefix of the final text')
  console.log('   respondent live updates:', tokens.length)
  assert.equal(count(w.events, 'agent_start', 'respondent'), 1); assert.equal(count(w.events, 'agent_start', 'critic'), 1)
  assert.deepEqual(await fake('/__stats'), { respondent: 1, critic: 1, synthesizer: 1, title: 1, reply: 0, summary: 0, proposer: 0, judge: 0, convene: 0 })
  assert.equal((await user('u1')).freeRunsUsed, 1, 'successful run is not refunded')
})

await scenario('2. three simultaneous viewers start only one run', async () => {
  await makeUser('u2', 'pro', 0); await makePanel('p2', 'u2')
  await Promise.all([runPanelJob('p2'), runPanelJob('p2'), runPanelJob('p2')])
  assert.equal((await panel('p2')).status, 'complete')
  const s = await fake('/__stats'); assert.equal(s.respondent, 1); assert.equal(s.critic, 1); assert.equal(s.synthesizer, 1)
})

await scenario('3. runner killed mid-critic resumes at the critic, not round 1', async () => {
  await fake('/__control', { tokenDelayMs: 150 })
  await makeUser('u3', 'pro', 0); await makePanel('p3', 'u3')
  const child = spawn(process.execPath, ['--import', path.join(HERE, 'register.mjs'), path.join(HERE, 'run-one.mjs'), 'p3'], { stdio: 'ignore', env: process.env })
  try {
    await until(async () => (await panel('p3'))?.live?.agent === 'critic', 'critic to start')
    await sleep(700)
  } finally {
    child.kill('SIGKILL') // also on failure, so an orphan runner can't skew later scenarios
  }
  const before = await panel('p3')
  const respondentText = before.rounds[0].respondent.content
  assert.equal(before.status, 'running'); assert.ok(before.run, 'dead runner left its lease')

  const s0 = await fake('/__stats')
  await runPanelJob('p3') // lease still fresh: must not start a second run
  assert.deepEqual(await fake('/__stats'), s0, 'no new calls while the dead lease is still fresh')

  await db.collection('panels').doc('p3').update({ 'run.heartbeatAt': Date.now() - 120000 }) // lease expires
  const w = watch('p3')
  await runPanelJob('p3'); await w.done
  const after = await panel('p3')
  assert.equal(after.status, 'complete')
  assert.equal(after.rounds[0].respondent.content, respondentText, 'completed respondent turn untouched')
  const s = await fake('/__stats')
  assert.equal(s.respondent, 1, 'respondent not re-run'); assert.equal(s.critic, 2, 'critic re-run once'); assert.equal(s.synthesizer, 1)
  assert.equal(count(w.events, 'agent_start', 'respondent'), 1, 'viewer sees respondent once')
  assert.ok(count(w.events, 'agent_start', 'critic') >= 1)
})

await scenario('4. a runner that loses its lease stops without failing the panel', async () => {
  await fake('/__control', { tokenDelayMs: 150 })
  await makeUser('u4', 'pro', 0); await makePanel('p4', 'u4')
  const running = runPanelJob('p4')
  await until(async () => (await panel('p4'))?.live?.agent === 'respondent', 'respondent to start')
  await db.collection('panels').doc('p4').update({ run: { id: 'intruder', heartbeatAt: Date.now() } })
  await running
  const p = await panel('p4')
  assert.equal(p.status, 'running'); assert.equal(p.errorMessage, null)
  assert.equal(p.rounds.length, 0, 'stale runner could not write its turn')
  assert.equal(p.run.id, 'intruder', "stale runner did not release someone else's lease")
})

await scenario('5. a failed run is marked error and refunded exactly once', async () => {
  await fake('/__control', { failRole: 'critic', tokenDelayMs: 5 })
  await makeUser('u5', 'free', 3); await makePanel('p5', 'u5', { runCounted: true })
  await runPanelJob('p5')
  const p = await panel('p5')
  assert.equal(p.status, 'error'); assert.match(p.errorMessage, /forced critic failure|500/)
  assert.equal(p.runCounted, false); assert.equal((await user('u5')).freeRunsUsed, 2)
  await refundRun('p5')
  assert.equal((await user('u5')).freeRunsUsed, 2, 'second refund is a no-op')
})

await scenario('6. twelve simultaneous free-tier panel creations: exactly 5 are allowed', async () => {
  await makeUser('u6', 'free', 0)
  const ref = db.collection('users').doc('u6')
  const outcomes = await Promise.all(Array.from({ length: 12 }, () =>
    // Extra attempts: 12-way contention on one doc can exhaust the default 5 retries.
    db.runTransaction((tx) => reserveRun(tx, ref, Date.now()), { maxAttempts: 25 }).then(() => 'ok', (e) => (e instanceof FreeLimitReachedError ? 'limit' : 'other:' + e.message))))
  assert.equal(outcomes.filter((o) => o === 'ok').length, 5, JSON.stringify(outcomes))
  assert.equal(outcomes.filter((o) => o === 'limit').length, 7)
  assert.equal((await user('u6')).freeRunsUsed, 5)
})

await scenario('7. an expired monthly window resets before counting', async () => {
  await makeUser('u7', 'free', 5, Date.now() - 1000)
  const ref = db.collection('users').doc('u7')
  await db.runTransaction((tx) => reserveRun(tx, ref, Date.now()))
  const u = await user('u7')
  assert.equal(u.freeRunsUsed, 1); assert.ok(u.freeRunsResetAt.toMillis() > Date.now() + 29 * 86400000)
})

await scenario('8. Stop mid-run: runner aborts within a second, run refunded, no further model calls', async () => {
  await fake('/__control', { tokenDelayMs: 100 })
  await makeUser('u8', 'free', 1); await makePanel('p8', 'u8', { runCounted: true })
  const running = runPanelJob('p8')
  await until(async () => ((await panel('p8'))?.live?.content ?? '').length > 0, 'respondent text')
  const t0 = Date.now()
  assert.deepEqual(await stopPanel('p8', 'u8'), { refunded: true })
  await running
  assert.ok(Date.now() - t0 < 3000, `runner took ${Date.now() - t0}ms to stop`)
  await sleep(300)
  const p = await panel('p8')
  assert.equal(p.status, 'error'); assert.equal(p.errorMessage, STOPPED_MESSAGE)
  assert.ok(p.stoppedAt); assert.equal(p.run, null); assert.equal(p.live, null, 'no stale live text left behind')
  assert.equal(p.runCounted, false); assert.equal((await user('u8')).freeRunsUsed, 0)
  const s = await fake('/__stats'); assert.equal(s.critic, 0); assert.equal(s.synthesizer, 0)
  await assert.rejects(stopPanel('p8', 'u8'), (e) => e instanceof StopRejected && e.status === 409)
  await assert.rejects(stopPanel('p8', 'someone-else'), (e) => e instanceof StopRejected && e.status === 404)
})

await scenario('9. Stop after the round-1 verdict: the run is not refunded', async () => {
  await fake('/__control', { tokenDelayMs: 30, decision: 'continue' })
  await makeUser('u9', 'free', 1); await makePanel('p9', 'u9', { runCounted: true })
  const running = runPanelJob('p9')
  await until(async () => (await panel('p9'))?.live?.round === 2, 'round 2 to start')
  assert.deepEqual(await stopPanel('p9', 'u9'), { refunded: false })
  await running
  assert.equal((await panel('p9')).status, 'error')
  assert.equal((await user('u9')).freeRunsUsed, 1)
})

await scenario('10. free users cannot get a Pro persona through the API', async () => {
  await makeUser('u10', 'free', 0)
  const id = await createPanel({ uid: 'u10', question: 'Should we raise a seed round now?', isPublic: false, persona: 'startup', maxRounds: 3 })
  await until(async () => (await panel(id))?.status === 'complete', 'panel to finish')
  const p = await panel(id)
  assert.equal(p.persona, 'general'); assert.equal(p.config.maxRounds, 2)
})

await scenario('11. rolling summary: folds messages that left the reply window, once', async () => {
  const cid = 'c11'
  await db.collection('conversations').doc(cid).set({ userId: 'u11', title: 'Launch', createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
  const batch = db.batch()
  for (let i = 0; i < 14; i++) {
    batch.set(db.collection('conversations').doc(cid).collection('messages').doc(`m${i}`), {
      role: i % 2 ? 'assistant' : 'user', kind: 'text', content: `${i}: ` + 'launch detail '.repeat(200),
      panelId: null, status: 'complete', seq: 1000 + i, createdAt: Timestamp.now(),
    })
  }
  await batch.commit()
  const history = await loadMessages(cid, 80)
  await updateSummary(cid, { history, summary: null, summarizedThroughSeq: 0 })
  const c = (await db.collection('conversations').doc(cid).get()).data()
  assert.equal(c.summary, 'They are planning a product launch next month.')
  assert.ok(c.summarizedThroughSeq >= 1000 && c.summarizedThroughSeq < 1013, `through ${c.summarizedThroughSeq}`)
  // Nothing new has left the window: no model call.
  await updateSummary(cid, { history, summary: c.summary, summarizedThroughSeq: c.summarizedThroughSeq })
  // A stale caller (summary already advanced by someone else) must not overwrite it.
  await updateSummary(cid, { history, summary: null, summarizedThroughSeq: 0 })
  assert.equal((await db.collection('conversations').doc(cid).get()).data().summarizedThroughSeq, c.summarizedThroughSeq)
  assert.equal((await fake('/__stats')).summary, 2)
})

await scenario('12. Stop while the Synthesizer call is pending aborts it', async () => {
  await fake('/__control', { tokenDelayMs: 5, synthDelayMs: 10000 })
  await makeUser('u12', 'pro', 0); await makePanel('p12', 'u12')
  const running = runPanelJob('p12')
  await until(async () => (await panel('p12'))?.rounds?.[0]?.critic, 'critic to finish')
  await sleep(300) // synthesizer request in flight
  const t0 = Date.now()
  assert.deepEqual(await stopPanel('p12', 'u12'), { refunded: false }, 'Pro runs are not counted, so nothing is refunded')
  await running
  assert.ok(Date.now() - t0 < 3000, `runner took ${Date.now() - t0}ms to stop`)
  const p = await panel('p12')
  assert.equal(p.status, 'error'); assert.equal(p.errorMessage, STOPPED_MESSAGE)
  assert.equal(p.rounds[0].synthesizer ?? null, null)
})

await scenario('13. rate limits: the 21st reply in a minute is refused; failed debate attempts are not counted', async () => {
  for (let i = 0; i < LIMITS.reply.max; i++) await rateLimit('reply', 'u13')
  await assert.rejects(rateLimit('reply', 'u13'), (e) => e instanceof RateLimitedError && e.retryAfterSeconds <= 60)
  await rateLimit('reply', 'u13b')
  // A free user out of runs keeps getting 402, never the hourly debate limit.
  await makeUser('u13c', 'free', 5)
  for (let i = 0; i < LIMITS.debate.max + 2; i++) {
    await assert.rejects(createPanel({ uid: 'u13c', question: 'Should we raise a seed round now?', isPublic: false }), (e) => e instanceof FreeLimitReachedError)
  }
  assert.equal((await db.collection('rateLimits').doc('debate:u13c').get()).exists, false)
})

await scenario('14. deleting a running chat debate stops it and removes its message', async () => {
  await fake('/__control', { tokenDelayMs: 100 })
  await makeUser('u14', 'free', 1)
  await db.collection('conversations').doc('c14').set({ userId: 'u14', title: null, createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
  const msgRef = db.collection('conversations').doc('c14').collection('messages').doc('m14')
  await msgRef.set({ role: 'assistant', kind: 'debate', content: '', panelId: 'p14', status: 'complete', seq: 1, createdAt: Timestamp.now() })
  await makePanel('p14', 'u14', { runCounted: true, conversationId: 'c14', messageId: 'm14' })
  const running = runPanelJob('p14')
  await until(async () => ((await panel('p14'))?.live?.content ?? '').length > 0, 'respondent text')
  assert.equal(await deletePanel('p14', 'someone-else'), false)
  assert.equal(await deletePanel('p14', 'u14'), true)
  await running
  assert.equal(await panel('p14'), undefined)
  assert.equal((await msgRef.get()).exists, false)
  assert.equal((await user('u14')).freeRunsUsed, 0, 'stopped before round 1: refunded')
})

await scenario('15. deleting an account removes all its data and its sign-in, and nothing else', async () => {
  await adminAuth().createUser({ uid: 'u15', email: 'u15@example.com' })
  await makeUser('u15', 'free', 2)
  await makePanel('p15a', 'u15', { status: 'complete' }); await makePanel('p15b', 'u15', { status: 'error' })
  await makePanel('p15-other', 'u2', { status: 'complete' })
  await db.collection('conversations').doc('c15').set({ userId: 'u15', title: 'x', createdAt: Timestamp.now(), updatedAt: Timestamp.now() })
  await db.collection('conversations').doc('c15').collection('messages').doc('m1').set({ role: 'user', kind: 'text', content: 'hi', panelId: null, status: 'complete', seq: 1 })
  await rateLimit('reply', 'u15')
  await deleteAccount('u15')
  assert.equal(await panel('p15a'), undefined); assert.equal(await panel('p15b'), undefined)
  assert.ok(await panel('p15-other'), "another user's panel is untouched")
  assert.equal((await db.collection('conversations').doc('c15').get()).exists, false)
  assert.equal((await db.collection('conversations').doc('c15').collection('messages').get()).size, 0)
  assert.equal((await db.collection('rateLimits').where('uid', '==', 'u15').get()).size, 0)
  assert.equal(await user('u15'), undefined)
  await assert.rejects(adminAuth().getUser('u15'), (e) => e.code === 'auth/user-not-found')
})

await scenario('16. panel list pages through everything, newest first, without repeats', async () => {
  const base = Date.now() - 100_000
  const batch = db.batch()
  for (let i = 0; i < PANEL_PAGE_SIZE + 5; i++) {
    batch.set(db.collection('panels').doc(`p16-${i}`), { userId: 'u16', question: `Question number ${i}`, title: null, persona: 'general', status: 'complete', isPublic: true, parentPanelId: null, confidence: 'high', createdAt: Timestamp.fromMillis(base + i * 1000) })
  }
  await batch.commit()
  const first = await listPanels('u16')
  assert.equal(first.panels.length, PANEL_PAGE_SIZE); assert.ok(first.next)
  assert.equal(first.panels[0].id, `p16-${PANEL_PAGE_SIZE + 4}`)
  // The cursor panel is deleted before "Show more": paging still continues after it.
  await db.collection('panels').doc(first.panels.at(-1).id).delete()
  const second = await listPanels('u16', first.next)
  assert.equal(second.panels.length, 5); assert.equal(second.next, null)
  assert.equal(new Set([...first.panels, ...second.panels].map((p) => p.id)).size, PANEL_PAGE_SIZE + 5)
  assert.deepEqual(await listPanels('u16', 'garbage'), { panels: [], next: null })
})

await scenario('17. compare mode: three proposers, a critic and a judge; viewers see it all', async () => {
  await fake('/__control', { tokenDelayMs: 5 })
  await makeUser('u17', 'pro', 0)
  const id = await createPanel({ uid: 'u17', question: 'Bootstrap, raise a seed round, or take a loan?', isPublic: true, mode: 'compare', persona: 'startup' })
  const w = watch(id)
  await w.done
  await until(async () => (await panel(id))?.title, 'title (written just after completion)')
  const p = await panel(id)
  assert.equal(p.status, 'complete'); assert.equal(p.mode, 'compare')
  assert.equal(p.compare.proposals.length, 3); assert.ok(p.compare.critic)
  assert.equal(p.compare.judgement.winner, 2); assert.equal(p.compare.judgement.scores.length, 3)
  assert.match(p.finalAnswer, /Plan B/); assert.equal(p.confidence, 'high'); assert.equal(p.title, 'Harness Panel Title')
  const s = await fake('/__stats')
  assert.deepEqual([s.proposer, s.critic, s.judge, s.respondent, s.synthesizer], [3, 1, 1, 0, 0])
  const starts = w.events.filter((e) => e.type === 'agent_start' && e.agent === 'proposer').map((e) => e.index)
  assert.deepEqual([...new Set(starts)], [0, 1, 2])
  assert.equal(w.events.filter((e) => e.type === 'compare_result').length, 1)
  assert.equal(w.events.at(-1).type, 'panel_complete')
})

await scenario('18. compare mode: a runner killed during proposer 2 resumes at proposer 2', async () => {
  await fake('/__control', { tokenDelayMs: 120 })
  await makeUser('u18', 'pro', 0)
  await makePanel('p18', 'u18', { mode: 'compare', compare: { proposals: [], critic: null, judgement: null } })
  const child = spawn(process.execPath, ['--import', path.join(HERE, 'register.mjs'), path.join(HERE, 'run-one.mjs'), 'p18'], { stdio: 'ignore', env: process.env })
  try {
    await until(async () => { const p = await panel('p18'); return p?.live?.agent === 'proposer' && p.live.index === 1 }, 'proposer 2 to start')
    await sleep(500)
  } finally {
    child.kill('SIGKILL')
  }
  const first = (await panel('p18')).compare.proposals[0].content
  await db.collection('panels').doc('p18').update({ 'run.heartbeatAt': Date.now() - 120000 })
  await fake('/__control', { tokenDelayMs: 5 })
  await runPanelJob('p18')
  const p = await panel('p18')
  assert.equal(p.status, 'complete')
  assert.equal(p.compare.proposals.length, 3)
  assert.equal(p.compare.proposals[0].content, first, 'stored proposal 1 untouched')
  assert.equal((await fake('/__stats')).proposer, 4, 'proposer 1 once, proposer 2 twice (killed + resumed), proposer 3 once')
})

await scenario('19. compare mode Stop: refunded while options are still coming, not after', async () => {
  await fake('/__control', { tokenDelayMs: 60 })
  await makeUser('u19', 'free', 2)
  await makePanel('p19a', 'u19', { runCounted: true, mode: 'compare', compare: { proposals: [], critic: null, judgement: null } })
  const a = runPanelJob('p19a')
  await until(async () => (await panel('p19a'))?.live?.index === 1, 'proposer 2 to start')
  assert.deepEqual(await stopPanel('p19a', 'u19'), { refunded: true })
  await a
  assert.equal((await user('u19')).freeRunsUsed, 1)

  await makePanel('p19b', 'u19', { runCounted: true, mode: 'compare', compare: { proposals: [], critic: null, judgement: null } })
  const b = runPanelJob('p19b')
  await until(async () => (await panel('p19b'))?.live?.agent === 'critic', 'critic to start')
  assert.deepEqual(await stopPanel('p19b', 'u19'), { refunded: false })
  await b
  assert.equal((await user('u19')).freeRunsUsed, 1, 'all options were in: the run counts')
})

await scenario('20. v1 migration: chains become conversations, idempotently; later follow-ups join their conversation', async () => {
  const at = (ms) => Timestamp.fromMillis(Date.now() - 86400000 + ms)
  const v1 = (id, parent, ms) => db.collection('panels').doc(id).set({
    userId: 'u20', question: `Question ${id}`, title: `Title ${id}`, persona: 'general', status: 'complete', isPublic: false,
    parentPanelId: parent, confidence: 'high', finalAnswer: `Answer ${id}`, rounds: [], createdAt: at(ms),
  })
  await makeUser('u20', 'free', 0)
  await v1('m-a', null, 1000); await v1('m-b', 'm-a', 2000); await v1('m-c', null, 3000)
  assert.equal(await migrateUserPanels('u20'), 3)
  assert.equal(await migrateUserPanels('u20'), 0, 'second run has nothing to do')
  const { conversations } = await listConversations('u20')
  assert.deepEqual(conversations.map((c) => [c.id, c.debateCount]).sort(), [['v1-m-a', 2], ['v1-m-c', 1]])
  const messages = (await db.collection('conversations').doc('v1-m-a').collection('messages').orderBy('seq').get()).docs.map((d) => d.data())
  assert.deepEqual(messages.map((m) => [m.role, m.kind, m.panelId]), [['user', 'text', null], ['assistant', 'debate', 'm-a'], ['user', 'text', null], ['assistant', 'debate', 'm-b']])
  assert.equal((await panel('m-b')).conversationId, 'v1-m-a')
  // A follow-up created later outside a conversation (conversationId: null) joins its parent's.
  await v1('m-d', 'm-b', 4000); await db.collection('panels').doc('m-d').update({ conversationId: null })
  assert.equal(await migrateUserPanels('u20'), 1)
  assert.equal((await panel('m-d')).conversationId, 'v1-m-a')
  assert.equal((await db.collection('conversations').doc('v1-m-a').get()).data().debateCount, 3)
})

for (const r of results) console.log(r.join('  '))
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0)
