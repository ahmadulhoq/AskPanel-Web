// Browser end-to-end checks: a real Chromium against `next start`, the Firebase emulators
// and the fake model API. Run via scripts/e2e/run.sh.
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'

// Resolves the project's playwright, or a global install via NODE_PATH (run.sh sets it).
const { chromium } = createRequire(import.meta.url)('playwright')
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3917'
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099'
const FAKE = `http://127.0.0.1:${process.env.FAKE_ANTHROPIC_PORT ?? 8099}`
const SHOTS = process.env.E2E_OUT ?? 'e2e-results'
mkdirSync(SHOTS, { recursive: true })
const fake = async (p, body) => (await fetch(FAKE + p, { method: body ? 'POST' : 'GET', body: body && JSON.stringify(body) })).json()

// Sign up a fresh emulator user and exchange its ID token for the app's session cookie.
async function sessionCookie() {
  const signUp = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `e2e-${randomUUID()}@example.com`, password: randomUUID(), returnSecureToken: true }),
  })
  const { idToken, localId } = await signUp.json()
  if (!idToken) throw new Error(`auth emulator sign-up failed (${signUp.status})`)
  const res = await fetch(BASE + '/api/auth/session', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }),
  })
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith('__session='))
  if (!cookie) throw new Error(`no session cookie from /api/auth/session (${res.status})`)
  return { cookie: cookie.split(';')[0].slice('__session='.length), uid: localId }
}

const FIRESTORE = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}/databases/(default)/documents`
const OWNER = { authorization: 'Bearer owner', 'content-type': 'application/json' }
async function makePro(uid) {
  const res = await fetch(`${FIRESTORE}/users/${uid}?updateMask.fieldPaths=subscription.tier`, {
    method: 'PATCH', headers: OWNER, body: JSON.stringify({ fields: { subscription: { mapValue: { fields: { tier: { stringValue: 'pro' } } } } } }),
  })
  if (!res.ok) throw new Error(`could not make the user Pro (${res.status})`)
}
const ts = (ms) => ({ timestampValue: new Date(ms).toISOString() })
async function seed(path, id, fields) {
  const res = await fetch(`${FIRESTORE}/${path}?documentId=${id}`, { method: 'POST', headers: OWNER, body: JSON.stringify({ fields }) })
  if (!res.ok) throw new Error(`seeding ${path}/${id} failed (${res.status})`)
}
// Older conversations, so the dashboard list has more than one page (30 per page).
const SEEDED_CONVERSATIONS = 32
async function seedConversations(uid) {
  const base = Date.now() - 3 * 86_400_000
  for (let i = 0; i < SEEDED_CONVERSATIONS; i++) {
    await seed('conversations', `seed-${i}`, {
      userId: { stringValue: uid }, title: { stringValue: `Seeded conversation ${i}` }, debateCount: { integerValue: '0' },
      createdAt: ts(base + i * 1000), updatedAt: ts(base + i * 1000),
    })
  }
}
// v1 panels as they were before conversations existed (no conversationId field): a
// follow-up chain and a standalone one. The first dashboard visit migrates them.
async function seedV1Panels(uid) {
  const base = Date.now() - 86_400_000
  const panel = (question, title, parent, at) => ({
    userId: { stringValue: uid }, question: { stringValue: question }, title: { stringValue: title },
    persona: { stringValue: 'general' }, status: { stringValue: 'complete' }, isPublic: { booleanValue: true },
    parentPanelId: parent ? { stringValue: parent } : { nullValue: null }, confidence: { stringValue: 'high' },
    finalAnswer: { stringValue: `## Verdict for ${title}\n\nA stored v1 answer.` }, rounds: { arrayValue: {} },
    config: { mapValue: { fields: { maxRounds: { integerValue: '2' }, model: { stringValue: 'claude-sonnet-4-5' } } } },
    createdAt: ts(at), completedAt: ts(at),
  })
  await seed('panels', 'v1root', panel('Should we expand to Europe next year?', 'Expanding to Europe', null, base))
  await seed('panels', 'v1follow', panel('Which country first, Germany or France?', 'Germany or France', 'v1root', base + 60_000))
  await seed('panels', 'v1alone', panel('Is a four-day week right for our team?', 'Four-day week', null, base + 120_000))
}
async function routingEvents(uid) {
  const res = await fetch(`${FIRESTORE}/routingEvents?pageSize=300`, { headers: OWNER })
  const { documents = [] } = await res.json()
  return documents.filter((d) => d.fields.uid.stringValue === uid).map((d) => d.fields.event.stringValue)
}

const { cookie, uid } = await sessionCookie()
await seedConversations(uid)
await seedV1Panels(uid)
const results = []
const check = (name, ok, detail = '') => results.push([ok ? 'PASS' : 'FAIL', name, detail])
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 650 } })
await ctx.addCookies([{ name: '__session', value: cookie, url: BASE }])
const page = await ctx.newPage()
const errors = []
// Set while a step provokes an error on purpose (e.g. an expected 409).
let expectErrors = false
page.on('console', (m) => { if (m.type() === 'error' && !expectErrors) errors.push(m.text()) })
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
// The thread's scroll container (ThreadScroller) — the first scrolling, overflowing div.
const onScroller = (action) => page.evaluate((action) => {
  const el = [...document.querySelectorAll('div')].find((d) => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight + 20)
  if (!el) return null
  if (action === 'top') el.scrollTop = 0
  return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight }
}, action)
const scrollState = () => onScroller('read')
const toTop = () => onScroller('top')

try {
  // ── Dashboard: v1 panels migrated into conversations ──────────────────
  await fake('/__control', { tokenDelayMs: 90 })
  await page.goto(BASE + '/dashboard')
  await page.screenshot({ path: `${SHOTS}/1-dashboard.png` })
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
  check('app renders in Geist, not the browser default serif', /geist/i.test(font), font)
  const migrated = page.locator('a[href="/chat/v1-v1root"]')
  check('v1 panels show up as conversations (a follow-up chain is one conversation)',
    await migrated.count() === 1 && /Expanding to Europe/.test(await migrated.innerText()) && /\b2\b/.test(await migrated.innerText())
      && await page.locator('a[href="/chat/v1-v1alone"]').count() === 1, await migrated.innerText().catch(() => ''))
  await migrated.click()
  await page.getByText('Panel verdict').nth(1).waitFor({ timeout: 15000 })
  const order = await page.evaluate(() => document.body.innerText.indexOf('expand to Europe') < document.body.innerText.indexOf('Germany or France'))
  check('a migrated conversation shows its debates in order', order && await page.getByRole('heading', { name: 'Verdict for Germany or France' }).count() === 1)
  await page.goto(BASE + '/p/v1root')
  check('a v1 share link still works', await page.getByRole('heading', { name: 'Verdict for Expanding to Europe' }).isVisible())

  // ── Composer settings: a locked Pro control opens the paywall ─────────
  await page.goto(BASE + '/dashboard')
  await page.getByTitle('Debate panel settings').click()
  await page.getByRole('button', { name: 'Custom', exact: true }).click()
  const paywallTitle = await page.getByRole('dialog').getByRole('heading').first().textContent({ timeout: 5000 })
  check('a locked Pro control opens the paywall as a feature lock, not "out of runs"', /Pro feature/.test(paywallTitle ?? ''), paywallTitle)
  await page.getByRole('button', { name: 'Maybe later' }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5000 })
  await page.getByTitle('Debate panel settings').click()

  // ── A debate from the dashboard: streaming markdown + scroll-follow ───
  await page.locator('textarea').first().fill('Should we raise a seed round now or wait six months?')
  await page.getByRole('button', { name: 'Debate', exact: true }).click()
  await page.waitForURL(/\/chat\/[^/?]+$/, { timeout: 15000 })
  const firstConvoUrl = page.url()
  await page.getByText('Respondent', { exact: true }).first().waitFor({ timeout: 20000 })
  await page.getByText('critic view').first().waitFor({ timeout: 30000 }) // critic is now streaming
  await toTop()
  const before = await scrollState()
  await page.waitForTimeout(2000)
  const after = await scrollState()
  check('reader who scrolled up is not yanked down while text streams', after && after.top < 50, JSON.stringify({ before, after }))
  check('"scroll to latest" button appears when scrolled up', await page.getByLabel('Scroll to latest').isVisible())
  await page.getByText('Panel Answer').waitFor({ timeout: 60000 })
  const panelUrl = `${BASE}/panel/${await page.locator('[data-panel-id]').first().getAttribute('data-panel-id')}`
  await page.getByLabel('Scroll to latest').click().catch(() => {})
  await page.waitForTimeout(800)
  await page.screenshot({ path: `${SHOTS}/2-panel-complete.png` })
  const md = await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((e) => /respondent view/.test(e.textContent))
    const p = h?.parentElement?.querySelector('p')
    const li = document.querySelector('li')
    return {
      h2: h && getComputedStyle(h).fontSize, p: p && getComputedStyle(p).fontSize,
      h2Weight: h && getComputedStyle(h).fontWeight, li: li && getComputedStyle(li).display,
      ulStyle: li && getComputedStyle(li.parentElement).listStyleType, tables: document.querySelectorAll('table').length,
      bold: [...document.querySelectorAll('strong, span, b')].some((e) => e.textContent === 'key point' && Number(getComputedStyle(e).fontWeight) >= 600),
    }
  })
  check('markdown renders styled (heading larger/bolder, bullets, tables, bold)',
    md.h2 && md.p && parseFloat(md.h2) > parseFloat(md.p) && Number(md.h2Weight) >= 600 && md.li === 'list-item' && md.ulStyle !== 'none' && md.tables >= 2 && md.bold,
    JSON.stringify(md))

  // ── v2 chat: quick reply, Debate this, Debate button, leave mid-debate ─
  await fake('/__control', { tokenDelayMs: 40 })
  await page.goto(BASE + '/chat')
  check('/chat now leads to the dashboard', /\/dashboard$/.test(page.url()), page.url())
  await page.locator('textarea').fill('Help me plan the launch of our product next month')
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/chat\/[^/?]+$/, { timeout: 15000 })
  await page.getByText('reply view').first().waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: 'Debate this' }).waitFor({ timeout: 20000 })
  check('first message sent once and removed from the URL', !page.url().includes('q='), page.url())
  check('quick reply streamed and rendered as markdown', await page.locator('h2', { hasText: 'reply view' }).count() === 1)
  const convoUrl = page.url()
  await page.screenshot({ path: `${SHOTS}/4-chat-reply.png` })

  await page.getByRole('button', { name: 'Debate this' }).click()
  await page.getByText('Panel deliberating…').waitFor({ timeout: 15000 })
  await page.waitForTimeout(1200)
  const debateHeader = await page.getByText('Panel deliberating…').boundingBox()
  check('starting a debate scrolls it into view', debateHeader && debateHeader.y > 50 && debateHeader.y < 520 && !(await page.getByLabel('Scroll to latest').isVisible()), JSON.stringify(debateHeader))
  await page.getByText('Panel verdict').first().waitFor({ timeout: 60000 })
  await page.screenshot({ path: `${SHOTS}/5-chat-debate-verdict.png` })
  check('"Debate this" runs the panel inline and shows the verdict', await page.getByText('Panel verdict').count() >= 1)

  // Debate settings: pick 1 round for the next debate (remembered on the conversation).
  await page.getByTitle('Debate panel settings').click()
  await page.getByRole('button', { name: '1 round', exact: true }).click()
  check('debate settings chip shows the chosen rounds', /General · 1 round$/.test(await page.getByTitle('Debate panel settings').innerText()))
  await page.waitForTimeout(300) // let the button colour transition finish
  await page.screenshot({ path: `${SHOTS}/5b-chat-debate-settings.png` })
  await page.getByTitle('Debate panel settings').click()

  await page.locator('textarea').fill('Should we launch on Product Hunt or Hacker News first?')
  await page.getByRole('button', { name: 'Debate', exact: true }).click()
  await page.getByText('Panel deliberating…').waitFor({ timeout: 15000 })
  await page.goto(BASE + '/chat') // leave immediately, mid-debate
  await page.waitForTimeout(12000)
  await page.goto(convoUrl)
  await page.getByText('Panel verdict').nth(1).waitFor({ timeout: 30000 }).catch(() => {})
  const verdicts = await page.getByText('Panel verdict').count()
  check('a debate finishes while nobody is watching', verdicts === 2, `verdict blocks after returning: ${verdicts}`)
  const chip = await page.getByTitle('Debate panel settings').innerText()
  check('debate settings are remembered by the conversation', /1 round$/.test(chip), chip)
  const bubbles = await page.locator('text=Should we launch on Product Hunt or Hacker News first?').count()
  check('conversation persists across reloads', bubbles === 1 && await page.locator('h2', { hasText: 'reply view' }).count() === 1)
  await page.getByRole('button', { name: 'Show debate' }).first().click()
  const expanded = await page.getByText('Respondent', { exact: true }).first().waitFor({ timeout: 15000 }).then(() => true, () => false)
  check('a finished debate expands to its full transcript', expanded && await page.getByText('critic view').count() >= 1)
  await page.screenshot({ path: `${SHOTS}/6-chat-after-return.png` })

  // Stop a running debate.
  await fake('/__control', { tokenDelayMs: 150 })
  await page.locator('textarea').fill('Should we hire a head of sales before product-market fit?')
  await page.getByRole('button', { name: 'Debate', exact: true }).click()
  await page.getByText('Panel deliberating…').waitFor({ timeout: 15000 })
  await page.getByText('Respondent', { exact: true }).last().waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  const stopped = await page.getByText('Debate stopped').waitFor({ timeout: 10000 }).then(() => true, () => false)
  check('Stop ends a running debate and says so', stopped && await page.getByText('You stopped this debate.').count() >= 1)
  await page.screenshot({ path: `${SHOTS}/7-chat-stopped.png` })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${SHOTS}/8-chat-mobile.png` })
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
  check('no horizontal overflow at phone width', !overflow)
  await page.setViewportSize({ width: 1280, height: 650 })

  // ── Compare options ───────────────────────────────────────────────────
  await fake('/__control', { tokenDelayMs: 10 })
  await page.goto(BASE + '/dashboard')
  await page.getByTitle('Debate panel settings').click()
  await page.getByRole('radio', { name: 'Compare options' }).click()
  check('compare mode hides the rounds picker', await page.getByText('Debate rounds').count() === 0)
  await page.getByTitle('Debate panel settings').click()
  await page.locator('textarea').first().fill('Bootstrap for a year, raise a seed round, or take a loan?')
  await page.getByRole('button', { name: 'Debate', exact: true }).click()
  await page.waitForURL(/\/chat\/[^/?]+$/, { timeout: 15000 })
  await page.getByText('Option 2 wins').waitFor({ timeout: 60000 })
  const compareUrl = `${BASE}/panel/${await page.locator('[data-panel-id]').first().getAttribute('data-panel-id')}`
  const optionLabels = await page.getByText(/^Option [123]$/).count()
  check('compare mode: three options, a winner, and the judge\'s answer',
    optionLabels === 3 && await page.getByText('Winner', { exact: true }).count() === 1 && await page.getByRole('heading', { name: 'Go with Plan B' }).count() === 1,
    `option labels: ${optionLabels}`)
  await page.getByText('Option 2 wins').scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${SHOTS}/11-compare.png` })
  await page.goto(compareUrl)
  await page.getByText('Option 2 wins').waitFor({ timeout: 15000 }).catch(() => {})
  check('the full transcript page shows the options and the winner',
    await page.getByText('Option 2 wins').isVisible() && await page.getByText(/^Option [123]$/).count() === 3
      && await page.getByText('Continue in the conversation →').isVisible())

  // ── Coordinator: the assistant decides when to convene the panel ─────
  await fake('/__control', { tokenDelayMs: 10 })
  await page.goto(convoUrl)
  await page.locator('textarea').fill('Should we hire a CFO now?')
  await page.keyboard.press('Enter')
  await page.getByText('This looks worth debating').waitFor({ timeout: 15000 })
  check('free tier: a debatable message gets a proposal, not a debate', await page.getByText('Panel deliberating…').count() === 0)
  await page.waitForTimeout(1000)
  const card = await page.getByRole('button', { name: 'Run the panel' }).boundingBox()
  check('the proposal scrolls into view', card && card.y > 0 && card.y + card.height < 520, JSON.stringify(card))
  await page.screenshot({ path: `${SHOTS}/12-proposal.png` })
  const repliesBefore = await page.locator('h2', { hasText: 'reply view' }).count()
  await page.getByRole('button', { name: 'Just answer' }).click()
  await page.locator('h2', { hasText: 'reply view' }).nth(repliesBefore).waitFor({ timeout: 15000 })
  check('"Just answer" turns the proposal into a direct reply', await page.getByText('This looks worth debating').count() === 0)

  await page.locator('textarea').fill('Should we raise prices or keep them?')
  await page.keyboard.press('Enter')
  await page.getByText('Compare options', { exact: true }).waitFor({ timeout: 15000 })
  await page.getByRole('button', { name: 'Run the panel' }).click()
  await page.getByText(/^Convening the panel/).waitFor({ timeout: 15000 })
  const verdictsBefore = await page.getByText('Panel verdict').count()
  await page.getByText('Panel verdict').nth(verdictsBefore).waitFor({ timeout: 60000 })
  check('"Run the panel" runs the proposed debate (compare mode, as the assistant chose)', await page.getByText('Option 2 wins').count() >= 1)

  await makePro(uid)
  await fake('/__control', { tokenDelayMs: 150 })
  await page.reload()
  await page.locator('textarea').fill('Should we open an office in Berlin?')
  await page.keyboard.press('Enter')
  await page.getByText('Panel deliberating…').waitFor({ timeout: 15000 })
  check('Pro: the assistant starts the debate itself and says why',
    await page.getByText(/^Convening the panel/).count() === 1 && await page.getByText(/^The assistant convened the panel/).count() === 1)
  // Two "Just answer" requests at once (double click, two tabs): one answers, one is refused.
  const mid = await page.locator('[data-message-id]').last().getAttribute('data-message-id')
  expectErrors = true
  const statuses = await page.evaluate(async ([path]) => {
    const post = () => fetch(path, { method: 'POST' }).then(async (r) => { await r.text(); return r.status })
    return (await Promise.all([post(), post()])).sort()
  }, [`${new URL(convoUrl).pathname.replace('/chat/', '/api/conversations/')}/messages/${mid}/answer`])
  await page.waitForTimeout(300)
  expectErrors = false
  check('two simultaneous "Just answer" requests produce one answer', JSON.stringify(statuses) === '[200,409]', JSON.stringify(statuses))
  const repliesNow = await page.locator('h2', { hasText: 'reply view' }).count()
  await page.reload()
  await page.locator('h2', { hasText: 'reply view' }).nth(repliesNow).waitFor({ timeout: 15000 })
  check('"Just answer" on a running debate stops it and answers directly', await page.getByText('Panel deliberating…').count() === 0)
  await fake('/__control', { tokenDelayMs: 10 })
  const events = await routingEvents(uid)
  const expected = ['answer', 'propose', 'just_answer', 'run_proposal', 'debate', 'debate_this', 'debate_button']
  check('routing decisions and overrides are logged', expected.every((e) => events.includes(e)), JSON.stringify(events))

  // ── Launch basics: legal pages, paging, deletion ─────────────────────
  await page.goto(BASE + '/')
  check('landing page links to the privacy policy and terms',
    await page.getByRole('link', { name: 'Privacy' }).count() === 1 && await page.getByRole('link', { name: 'Terms' }).count() === 1)
  await page.goto(BASE + '/privacy')
  check('privacy policy renders', await page.getByRole('heading', { name: 'Privacy policy' }).isVisible())
  await page.screenshot({ path: `${SHOTS}/9-privacy.png` })
  await page.goto(BASE + '/terms')
  check('terms render', await page.getByRole('heading', { name: 'Terms of service' }).isVisible())

  await page.goto(BASE + '/dashboard')
  const conversationLinks = page.locator('main a[href^="/chat/"]')
  const firstPage = await conversationLinks.count()
  await page.getByRole('button', { name: 'Show more' }).click()
  await page.getByText('Seeded conversation 0', { exact: true }).waitFor({ timeout: 10000 })
  const allConversations = await conversationLinks.count()
  check('dashboard lists 30 conversations, then the rest on "Show more"',
    firstPage === 30 && allConversations > 30 && await page.getByRole('button', { name: 'Show more' }).count() === 0, `${firstPage} → ${allConversations}`)
  await page.getByPlaceholder('Search conversations…').fill('Europe')
  check('searching narrows the list', await conversationLinks.count() === 1)

  const panelId = new URL(panelUrl).pathname.split('/').pop()
  await page.goto(panelUrl)
  await page.getByRole('button', { name: 'Delete panel' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await page.waitForURL(firstConvoUrl, { timeout: 10000 })
  check('a panel can be deleted (and leaves its conversation)', await page.locator(`[data-panel-id="${panelId}"]`).count() === 0)

  await page.goto(convoUrl)
  await page.getByRole('button', { name: 'Delete conversation' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click()
  await page.waitForURL(/\/dashboard$/, { timeout: 10000 })
  check('a conversation can be deleted', await page.locator(`a[href="${new URL(convoUrl).pathname}"]`).count() === 0)

  await page.goto(BASE + '/account')
  await page.getByRole('button', { name: 'Delete account' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('textbox').fill('DELETE')
  await page.screenshot({ path: `${SHOTS}/10-delete-account.png` })
  await dialog.getByRole('button', { name: 'Delete account' }).click()
  await page.waitForURL(BASE + '/', { timeout: 15000 })
  await page.goto(BASE + '/dashboard')
  check('deleting the account signs you out', /\/login/.test(page.url()), page.url())
} catch (e) {
  check('script ran to completion', false, e.message.split('\n')[0])
  await page.screenshot({ path: `${SHOTS}/error.png` }).catch(() => {})
}
check('no browser console errors', errors.length === 0, errors.slice(0, 5).join(' | '))
console.log('fake API calls:', JSON.stringify(await fake('/__stats')))
for (const r of results) console.log(r.join('  '))
await browser.close()
process.exit(results.some((r) => r[0] === 'FAIL') ? 1 : 0)
