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
  assert.deepEqual(await fake('/__stats'), { respondent: 1, critic: 1, synthesizer: 1, title: 1, reply: 0 })
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

for (const r of results) console.log(r.join('  '))
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0)
