# AskPanel Web — MVP Engineering Plan

## Context
Greenfield build of AskPanel: a multi-agent AI deliberation web app. User submits a question → 3 agents (Respondent, Critic, Synthesizer) debate it in rounds → structured final answer with confidence level. Core IP is the orchestration loop. Stack: Next.js 15, Firebase (Auth + Firestore + App Hosting), Anthropic Claude, Stripe. SSE streaming, auth-required, public shareable panels.

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
- Stripe: 5 free runs total, Pro $15/mo

---

## Firestore Schema

### `users/{uid}`
```
email: string
displayName: string
photoURL: string | null
createdAt: Timestamp
freeRunsUsed: number        // lifetime total (MVP); Firestore transaction on increment
subscription: {
  tier: 'free' | 'pro'
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: Timestamp | null
}
```

### `panels/{panelId}`
```
userId: string
question: string
status: 'queued' | 'running' | 'complete' | 'error'
isPublic: boolean           // default true; enables /p/[panelId] view
createdAt: Timestamp
completedAt: Timestamp | null
config: {
  maxRounds: number         // 2 for MVP
  model: string             // 'claude-sonnet-4-5'
}
rounds: Array<{
  roundNumber: number
  respondent: { content: string } | null
  critic: { content: string } | null
  synthesizer: {
    decision: 'continue' | 'consensus' | 'contested'
    reasoning: string
    confidence: 'high' | 'medium' | 'low' | 'contested'
  } | null
}>
finalAnswer: string | null
confidence: 'high' | 'medium' | 'low' | 'contested' | null
errorMessage: string | null
```

---

## SSE Event Stream Protocol

```
{ type: 'agent_start',      agent: 'respondent'|'critic', round: number }
{ type: 'agent_token',      agent: 'respondent'|'critic', token: string }
{ type: 'agent_complete',   agent: 'respondent'|'critic', round: number, content: string }
{ type: 'synthesis_start',  round: number }
{ type: 'synthesis_result', round: number, decision: 'continue'|'consensus'|'contested', confidence: string, reasoning: string }
{ type: 'panel_complete',   finalAnswer: string, confidence: string }
{ type: 'error',            message: string }
```

Synthesizer does NOT stream — it uses `tool_use` for structured JSON output (fast, short).
Respondent and Critic stream tokens for live UX.

---

## Agent Orchestration (lib/agents/orchestrator.ts)

```
async function* runPanel(panelId, question, config): AsyncGenerator<SSEEvent>
  for round = 1..config.maxRounds:
    // Respondent streams
    yield agent_start(respondent, round)
    for token of streamClaude(respondentPrompt, history):
      yield agent_token(respondent, token)
    yield agent_complete(respondent, fullContent)
    writeRoundToFirestore(panelId, round, 'respondent', fullContent)

    // Critic streams
    yield agent_start(critic, round)
    for token of streamClaude(criticPrompt, history):
      yield agent_token(critic, token)
    yield agent_complete(critic, fullContent)
    writeRoundToFirestore(panelId, round, 'critic', fullContent)

    // Synthesizer — structured JSON, no streaming
    yield synthesis_start(round)
    synthesis = callClaudeWithToolUse(synthesizerPrompt, history)
    yield synthesis_result(round, synthesis)
    writeRoundToFirestore(panelId, round, 'synthesizer', synthesis)

    if synthesis.decision !== 'continue': break

  yield panel_complete(finalAnswer, confidence)
  updatePanelStatus(panelId, 'complete', finalAnswer, confidence)
```

---

## API Routes

### POST /api/panels
- Verify session cookie (Firebase Admin)
- Check usage: `freeRunsUsed < 5` OR `subscription.tier === 'pro'` (Firestore transaction)
- Create `panels/{panelId}` doc with status `queued`
- Return `{ panelId }`

### GET /api/panels/[panelId]/stream
- Verify session cookie
- Verify `panel.userId === uid`
- Return `text/event-stream` (no buffering)
- Run `runPanel()` generator, pipe events to SSE
- On complete: update Firestore, increment `freeRunsUsed` (transaction)
- On error: update panel status to `error`
- Set Cloud Run timeout to 300s in `apphosting.yaml`

### POST /api/auth/session
- Accept Firebase ID token from client
- Exchange for session cookie via `firebase-admin` (`createSessionCookie`, 14 days)
- Set `HttpOnly; Secure; SameSite=Lax` cookie

### DELETE /api/auth/session
- Clear session cookie (sign out)

### POST /api/stripe/create-checkout
- Create Stripe Checkout session (price_id for Pro)
- Return `{ url }` → client redirects

### POST /api/stripe/webhook
- Verify Stripe signature
- Handle `checkout.session.completed`: update `users/{uid}.subscription`
- Handle `customer.subscription.deleted`: downgrade to free
- Idempotent: check existing state before writing

---

## Auth Middleware (middleware.ts)

```
Protected: /dashboard/*, /panel/*
Public:    /, /login, /signup, /p/*

On each protected request:
  cookie = req.cookies['__session']
  if !cookie → redirect /login
  decoded = firebase-admin.verifySessionCookie(cookie)
  if expired/invalid → redirect /login
  attach uid to request headers (x-uid)
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

## Project Structure

```
AskPanel-Web/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx            // auth guard
│   │   ├── dashboard/page.tsx    // panel history
│   │   └── panel/[panelId]/page.tsx
│   ├── p/[panelId]/page.tsx      // public share view
│   ├── api/
│   │   ├── panels/route.ts
│   │   ├── panels/[panelId]/stream/route.ts
│   │   ├── auth/session/route.ts
│   │   ├── stripe/create-checkout/route.ts
│   │   └── stripe/webhook/route.ts
│   ├── layout.tsx
│   └── page.tsx                  // landing
├── lib/
│   ├── firebase/client.ts        // client SDK init
│   ├── firebase/admin.ts         // admin SDK init
│   ├── agents/orchestrator.ts
│   ├── agents/prompts.ts         // system prompts per role
│   ├── agents/types.ts
│   ├── anthropic.ts              // Anthropic client + helpers
│   └── stripe.ts
├── components/
│   ├── panel/PanelInput.tsx
│   ├── panel/PanelThread.tsx     // SSE-driven live thread
│   ├── panel/AgentTurn.tsx       // per-agent streaming card
│   ├── panel/FinalAnswer.tsx
│   ├── panel/ConfidenceBadge.tsx
│   ├── auth/AuthForm.tsx
│   └── ui/                       // shadcn components
├── hooks/
│   ├── usePanel.ts               // SSE client + state machine
│   └── useAuth.ts
├── middleware.ts
├── types/index.ts
├── apphosting.yaml               // Cloud Run timeout: 300s
└── docs/engineering/plans/mvp-architecture.md
```

---

## Build Order (each step independently shippable)

1. Scaffold — `create-next-app`, Firebase config, shadcn init, env vars
2. Auth — Firebase Auth, session cookie API, middleware, login page
3. Agent Engine — orchestrator + prompts (test via `ts-node` script first)
4. SSE Routes — POST /api/panels + GET stream route
5. Panel UI — PanelInput → navigate → PanelThread (SSE hook)
6. Usage Limits — run counter, paywall modal
7. Stripe — checkout + webhook
8. Share Links — `/p/[panelId]` + OG meta
9. Dashboard — panel history list
10. Landing page + polish

---

## Failure Points

1. **Firestore transaction race on free-run check** — two parallel runs both pass limit. Fix: `runTransaction` wraps read+check+increment atomically.
2. **Cloud Run 60s default timeout kills long runs** — Fix: `apphosting.yaml` sets `runConfig.timeoutSeconds: 300`.
3. **SSE client disconnect mid-run** — server continues (writes to Firestore). Client reconnects and loads panel state from Firestore directly (no SSE replay needed — status is in DB).
4. **Stripe webhook duplicate events** — `checkout.session.completed` can fire twice. Fix: check if `stripeSubscriptionId` already set before updating.
5. **Unauthenticated Firestore read on /p/[panelId]** — Firestore Security Rules must allow reads where `isPublic == true` without auth. Enforce on server-side render via Admin SDK to bypass rules safely.

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
FIREBASE_SESSION_COOKIE_SECRET  # for signing

# Anthropic
ANTHROPIC_API_KEY

# Stripe
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_PRO_PRICE_ID
```
