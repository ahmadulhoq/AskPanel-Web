# AskPanel Web — Engineering Plan

## Product Positioning

> **AskPanel is a second opinion — not a faster first answer.**

The product exists for high-stakes, low-reversibility decisions where the user suspects a single AI will confirm their existing view. Career pivots, business strategy, investment theses, legal questions, ethical dilemmas. The deliberation process (Respondent → Critic → Synthesizer) mirrors how good human decision-making works: form a view, challenge it, synthesize the tension. The confidence score is the proof that the debate produced something better than the first answer alone.

This positioning drives every prioritisation call. Features that make the deliberation more legible, the answer more actionable, or the product easier to return to are high priority. Features that make it faster or cheaper are not.

---

## Context

Multi-agent AI deliberation web app. User submits a question → 3 agents (Respondent, Critic, Synthesizer) debate it in rounds → structured final answer with confidence level. Core IP is the orchestration loop. Stack: Next.js 15, Firebase (Auth + Firestore + App Hosting), Anthropic Claude, Stripe. SSE streaming, auth-required, public shareable panels.

---

## Confirmed Decisions

- Next.js 15 (App Router, TypeScript, strict)
- Tailwind CSS + shadcn/ui
- Firebase Auth (Google OAuth primary, email/password secondary)
- Firestore (NoSQL, document-shaped panel runs)
- Firebase App Hosting (Cloud Run, supports long-lived SSE)
- Anthropic SDK — Claude Sonnet 4.5
- SSE streaming with persist-first (Firestore doc created before stream opens)
- Auth-required from run 1 (no anonymous usage)
- Public share view at `/p/[panelId]` (no login to view)
- Structured JSON output from Synthesizer (tool use / forced JSON)
- Stripe: 5 free runs / month, Pro $15/mo

---

## Firestore Schema

### `users/{uid}`
```
email: string
displayName: string
photoURL: string | null
createdAt: Timestamp
freeRunsUsed: number          // runs used this billing period
freeRunsResetAt: Timestamp    // next monthly reset date; set on first run
subscription: {
  tier: 'free' | 'pro'
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: Timestamp | null
}
```

**Note on free run limit:** `freeRunsUsed` resets monthly. On each POST /api/panels,
if `now >= freeRunsResetAt`, zero out `freeRunsUsed` and advance `freeRunsResetAt` by
one month before checking the limit. This lets evaluators return after a month without
hitting a permanent wall. Initial MVP shipped with a lifetime counter; migration sets
`freeRunsResetAt = createdAt + 30 days` for existing users.

### `panels/{panelId}`
```
userId: string
question: string
title: string | null          // auto-generated 5–8 word summary after completion
status: 'queued' | 'running' | 'complete' | 'error'
isPublic: boolean             // user-controlled; default true
persona: string               // 'general' | 'startup' | 'legal' | 'technical' | 'devils-advocate'
parentPanelId: string | null  // set when this is a follow-up to another panel
createdAt: Timestamp
completedAt: Timestamp | null
config: {
  maxRounds: number           // 1–3; default 2 (free), up to 3 (pro)
  model: string               // 'claude-sonnet-4-5'
}
rounds: Array<{
  roundNumber: number
  respondent: { content: string } | null
  critic: { content: string } | null
  synthesizer: {
    decision: 'continue' | 'consensus' | 'contested'
    reasoning: string
    confidence: 'high' | 'medium' | 'low' | 'contested'
    issuesFound: number       // count of Critic objections; drives "Critic found N issues" label
  } | null
}>
finalAnswer: string | null
confidence: 'high' | 'medium' | 'low' | 'contested' | null
errorMessage: string | null
context: string | null        // extracted text from file/URL input (pro only)
```

---

## SSE Event Stream Protocol

```
{ type: 'agent_start',      agent: 'respondent'|'critic', round: number }
{ type: 'agent_token',      agent: 'respondent'|'critic', token: string }
{ type: 'agent_complete',   agent: 'respondent'|'critic', round: number, content: string }
{ type: 'synthesis_start',  round: number }
{ type: 'synthesis_result', round: number, decision: 'continue'|'consensus'|'contested',
                             confidence: string, reasoning: string, issuesFound: number }
{ type: 'panel_complete',   finalAnswer: string, confidence: string }
{ type: 'error',            message: string }
```

Synthesizer does NOT stream — it uses `tool_use` for structured JSON output (fast, short).
Respondent and Critic stream tokens for live UX.

`issuesFound` is extracted from the Synthesizer tool call and surfaced in the UI as
"The Critic found N issue(s) with this answer" before the Critic turn renders — making
the deliberation value visible to users who might otherwise just read the final answer.

---

## Agent Orchestration (lib/agents/orchestrator.ts)

```
async function* runPanel(panelId, question, config, persona, context?): AsyncGenerator<SSEEvent>
  for round = 1..config.maxRounds:
    respondentPrompt = buildRespondentPrompt(question, history, persona, context)
    yield agent_start(respondent, round)
    for token of streamClaude(respondentPrompt):
      yield agent_token(respondent, token)
    yield agent_complete(respondent, fullContent)
    writeRoundToFirestore(panelId, round, 'respondent', fullContent)

    criticPrompt = buildCriticPrompt(question, history, persona)
    yield agent_start(critic, round)
    for token of streamClaude(criticPrompt):
      yield agent_token(critic, token)
    yield agent_complete(critic, fullContent)
    writeRoundToFirestore(panelId, round, 'critic', fullContent)

    synthPrompt = buildSynthesizerPrompt(question, history, isFinalRound)
    yield synthesis_start(round)
    synthesis = callClaudeWithToolUse(synthPrompt)
    yield synthesis_result(round, synthesis)
    writeRoundToFirestore(panelId, round, 'synthesizer', synthesis)

    if synthesis.decision !== 'continue': break

  // After debate: generate short title asynchronously (non-blocking)
  generateTitleAsync(panelId, question, finalAnswer)

  yield panel_complete(finalAnswer, confidence)
  updatePanelStatus(panelId, 'complete', finalAnswer, confidence)
```

### Persona System

Each persona is a set of system prompt overrides for Respondent and Critic. The Synthesizer
prompt is persona-agnostic (its job is always structural). Personas ship as a static map in
`lib/agents/personas.ts`:

```typescript
export const PERSONAS: Record<string, { label: string; respondent: string; critic: string }> = {
  general:        { label: 'General',          respondent: RESPONDENT_SYSTEM,       critic: CRITIC_SYSTEM },
  startup:        { label: 'Startup Advisor',  respondent: STARTUP_RESPONDENT,      critic: STARTUP_CRITIC },
  legal:          { label: 'Legal Lens',       respondent: LEGAL_RESPONDENT,        critic: LEGAL_CRITIC },
  technical:      { label: 'Technical Audit',  respondent: TECHNICAL_RESPONDENT,    critic: TECHNICAL_CRITIC },
  devilsadvocate: { label: "Devil's Advocate", respondent: DEVILS_RESPONDENT,       critic: DEVILS_CRITIC },
}
```

Free tier: `general` only. Pro tier: all personas.
Custom personas (user-defined system prompts) are a later Pro-only feature.

### Follow-up Question Flow

When a user submits a follow-up from a completed panel, `POST /api/panels` accepts an
optional `parentPanelId`. The orchestrator fetches the parent panel's `finalAnswer` and
prepends it to the question context:

```
Question: <original question>

Context from previous panel:
<parent finalAnswer>

Follow-up: <new question>
```

This is passed as the `context` field to `buildRespondentPrompt`. The parent panel's
Respondent/Critic/Synthesizer history is NOT replayed (too long; the finalAnswer captures
the essence). The child panel stores `parentPanelId` for UI linking.

### Title Generation

After `panel_complete`, a fire-and-forget call generates a title:

```typescript
async function generateTitleAsync(panelId: string, question: string, answer: string) {
  const title = await getAnthropicClient().messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 30,
    messages: [{
      role: 'user',
      content: `Summarise this question in 5–8 words, no punctuation:\n${question}`
    }]
  })
  await adminDb().collection('panels').doc(panelId).update({ title: extractText(title) })
}
```

Non-blocking: the panel is already complete when this runs. Dashboard falls back to
truncated question if `title` is null.

---

## API Routes

### POST /api/panels
- Verify session cookie
- Check monthly run limit (reset if `now >= freeRunsResetAt`)
- Accept `{ question, persona?, parentPanelId?, isPublic?, maxRounds? }` — validate all
- Create `panels/{panelId}` doc with status `queued`
- Return `{ panelId }`

### GET /api/panels/[panelId]/stream
- Verify session cookie + ownership
- If `status === 'complete'`: emit stored rounds as replay events, then `panel_complete` — client
  gets the full thread without re-running the orchestrator
- If `status === 'running'`: emit stored rounds first (replay), then continue piping live SSE
  — this fixes the reconnection gap where users lose progress on navigation
- If `status === 'queued'`: run orchestrator as normal
- On `panel_complete`: increment `freeRunsUsed` (monthly transaction)

**Reconnection replay contract:**
```
for each round in panel.rounds (already complete):
  emit agent_start, agent_complete (no tokens — replay is instant)
  emit synthesis_result
emit panel_complete if status === complete
then hand off to live SSE generator (if still running)
```

### POST /api/panels/[panelId]/title  *(internal, called server-side)*
- Not a public route; title generation is called from the stream route after completion

### GET /api/account/export/[panelId]
- Verify session cookie + ownership
- Render panel as Markdown string (question + each round turn + finalAnswer)
- Return as `text/markdown` download attachment
- PDF export: same content passed to `@react-pdf/renderer` on the server, returns `application/pdf`

### POST /api/panels/[panelId]/context  *(file/URL upload — Pro only)*
- Verify session cookie + pro tier
- Accept multipart form (PDF, txt, md) or `{ url: string }`
- Extract text (PDF: `pdf-parse`; URL: fetch + readability strip)
- Store as `panels/{panelId}.context` (max 8000 tokens; truncate with warning)
- Return `{ contextLength }` for UI feedback

### DELETE /api/auth/session
- Clear session cookie (sign out)

### POST /api/stripe/create-checkout
- Create Stripe Checkout session
- Return `{ url }` → client redirects

### POST /api/stripe/webhook
- Handle `checkout.session.completed` → upgrade to pro
- Handle `customer.subscription.deleted` → downgrade to free
- Idempotent on both

### POST /api/account/delete
- Verify session cookie
- Delete all `panels/{uid}/*` documents (batch)
- Delete `users/{uid}`
- Call `firebase-admin.auth().deleteUser(uid)`
- Clear session cookie

---

## Auth Middleware (proxy.ts)

```
Protected: /dashboard/*, /panel/*
Public:    /, /login, /p/*, /api/stripe/webhook

On each protected request:
  cookie = req.cookies['__session']
  if !cookie → redirect /login
  decoded = firebase-admin.verifySessionCookie(cookie)
  if expired/invalid → redirect /login
```

---

## Firestore Security Rules

```
panels/{panelId}:
  read: isOwner(uid) || resource.data.isPublic == true
  write: isOwner(uid)

users/{uid}:
  read/write: uid == request.auth.uid
```

---

## Project Structure (target state)

```
AskPanel-Web/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx          // history + starter questions
│   │   ├── panel/[panelId]/page.tsx    // live thread + share + follow-up
│   │   └── account/page.tsx            // sign out, cancel sub, delete account
│   ├── p/[panelId]/page.tsx            // public share view
│   ├── api/
│   │   ├── panels/route.ts
│   │   ├── panels/[panelId]/stream/route.ts
│   │   ├── panels/[panelId]/context/route.ts   // file/URL upload (pro)
│   │   ├── account/export/[panelId]/route.ts   // markdown/pdf download
│   │   ├── account/delete/route.ts
│   │   ├── auth/session/route.ts
│   │   ├── stripe/create-checkout/route.ts
│   │   └── stripe/webhook/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── firebase/client.ts
│   ├── firebase/admin.ts
│   ├── agents/
│   │   ├── orchestrator.ts
│   │   ├── prompts.ts
│   │   ├── personas.ts                 // persona system prompt map
│   │   └── types.ts
│   ├── context/
│   │   ├── extract-url.ts              // fetch + readability
│   │   └── extract-pdf.ts             // pdf-parse wrapper
│   ├── anthropic.ts
│   └── stripe.ts
├── components/
│   ├── panel/
│   │   ├── PanelInput.tsx              // composer + persona selector + privacy toggle
│   │   ├── PanelThread.tsx
│   │   ├── AgentTurn.tsx               // includes "Critic found N issues" label
│   │   ├── FinalAnswer.tsx             // includes copy + export + follow-up buttons
│   │   ├── QuestionBubble.tsx
│   │   ├── ConfidenceBadge.tsx
│   │   ├── SynthesisCard.tsx
│   │   ├── PersonaSelector.tsx         // pill group for persona choice
│   │   ├── FollowUpComposer.tsx        // post-completion question input
│   │   └── PaywallDialog.tsx
│   ├── dashboard/
│   │   └── StarterQuestions.tsx        // example question chips
│   ├── auth/AuthForm.tsx
│   └── ui/
├── hooks/
│   ├── usePanel.ts                     // SSE + reconnection replay
│   └── useAuth.ts
├── proxy.ts
├── types/index.ts
├── apphosting.yaml
└── docs/engineering/plans/mvp-architecture.md
```

---

## Build Phases

### Phase 1 — MVP (complete)
1. Scaffold — Next.js, Firebase, shadcn, env vars
2. Auth — Firebase Auth, session cookie, middleware, login page
3. Agent engine — orchestrator + prompts
4. SSE routes — POST /api/panels + GET stream
5. Panel UI — PanelInput → PanelThread (SSE hook)
6. Usage limits — run counter, paywall modal
7. Stripe — checkout + webhook
8. Share links — `/p/[panelId]` + OG meta
9. Dashboard — panel history
10. Landing page + UI polish

### Phase 2 — Experience Polish (makes value prop legible)
Goal: users understand what they got and can act on it.

11. **Fix Share button** — wire `navigator.clipboard.writeText` + toast to `#share-btn`
12. **Sign-out + account page** — sign-out in header; `/account` with Stripe portal link + delete account
13. **Privacy toggle** — checkbox in PanelInput sets `isPublic: false`; dashboard shows a lock icon on private panels
14. **Copy final answer** — clipboard button on `FinalAnswer`; copies markdown
15. **Starter questions** — 5–6 clickable example chips on dashboard by topic (Career, Strategy, Technical, Ethics); clicking pre-fills the composer
16. **"Critic found N issues" label** — surfaced above the Critic turn; makes the deliberation value obvious at a glance
17. **Reconnection replay** — stream route emits stored rounds before live SSE; users who navigate away mid-run get a full thread on return
18. **Auto-generated panel title** — fire-and-forget title generation after completion; replaces truncated question in dashboard

### Phase 3 — Retention & Depth (turns a one-shot tool into a thinking partner)
Goal: users come back and go deeper.

19. **Follow-up question composer** — appears below FinalAnswer; creates a child panel with parent context; links back to parent in dashboard
20. **Persona selector** — pill group in PanelInput (General, Startup Advisor, Legal Lens, Technical Audit, Devil's Advocate); free tier locked to General; others require Pro
21. **Monthly run reset** — migrate `freeRunsUsed` to monthly bucket with `freeRunsResetAt`; existing users get a reset window

### Phase 4 — Pro Differentiation (justifies $15/mo beyond run count)
Goal: Pro feels qualitatively different, not just quantitatively more.

22. **File / URL context input** — paste a URL or upload PDF before asking; text extracted server-side, prepended to question as context; Pro only
23. **Panel export** — "Download" on completed panel; Markdown immediately, PDF via `@react-pdf/renderer`; available to all tiers (share-ability is a growth loop)
24. **Configurable max rounds** — 1 round (quick) or 3 rounds (thorough) selector; Pro can use 3; free locked to 2
25. **Custom persona** — Pro users write their own Respondent/Critic system prompts; stored in `users/{uid}/personas`

### Phase 5 — Growth (acquisition and word-of-mouth)
Goal: the product markets itself through the quality of shareable outputs.

26. **Onboarding tour** — first-run tooltip sequence explaining Respondent/Critic/Synthesizer; one-time, dismissable
27. **Public panel gallery** — curated feed of interesting deliberations at `/explore`; requires moderation strategy; opt-in per panel
28. **OG image generation** — dynamic `/api/og/[panelId]` using `@vercel/og` that renders question + confidence badge; makes share links visually compelling on social

---

## Failure Points

1. **Firestore transaction race on free-run check** — Fix: `runTransaction` wraps read+check+increment atomically.
2. **Cloud Run 60s default timeout** — Fix: `apphosting.yaml` sets `runConfig.timeoutSeconds: 300`.
3. **SSE disconnect mid-run** — Fix (Phase 2, item 17): replay stored rounds on reconnect; server continues writing to Firestore regardless of client state.
4. **Stripe webhook duplicate events** — Fix: idempotency check on `stripeSubscriptionId` before writing.
5. **Unauthenticated read on /p/[panelId]** — Fix: server-side Admin SDK read bypasses Firestore rules; rules are a belt-and-suspenders backup.
6. **Monthly reset race condition** — Two concurrent panel submissions both see `freeRunsUsed < 5` before either increments. Fix: wrap reset + increment in the same `runTransaction` that already guards the limit check.
7. **Context length overflow (file upload)** — User uploads a 200-page PDF. Fix: extract text, tokenise with `@anthropic-ai/tokenizer`, truncate to 8000 tokens with a visible warning in the UI before the panel runs.
8. **Title generation failure** — Non-blocking; panel is already complete. Fix: catch and log; dashboard falls back to truncated question. Retry once with exponential backoff; no user-facing error.

---

## Environment Variables

```
# Firebase
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_ADMIN_PRIVATE_KEY
FIREBASE_ADMIN_CLIENT_EMAIL
FIREBASE_SESSION_COOKIE_SECRET

# Anthropic
ANTHROPIC_API_KEY

# Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRO_PRICE_ID
```
