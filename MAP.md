# Project Map: askpanel-web
> Last updated: 2026-11-01 (CI + e2e suite; PR-based git flow)

## Architecture Pattern
- Pattern: Next.js 16 App Router — Server Components for data, Client Components pushed to the leaves (verified against current Next.js 16 best practice via web search, Sept 2026)
- Auth: Firebase Auth (client SDK for sign-in) + session cookies verified via Firebase Admin SDK (server-side)
- DB: Firestore (NoSQL document model) — Admin SDK only. `firestore.rules` deny all client access (2026-10-31); the browser must never talk to Firestore
- UI: Tailwind CSS v4 + shadcn/ui (built on `@base-ui/react` primitives + `class-variance-authority`)
- Navigation: Next.js App Router file-based routing, incl. route groups `(app)` (protected) and `(auth)` (public)
- Serialization boundary: server components map Firestore documents (which carry `Timestamp` objects) to plain serializable types before passing props to client components — see CONVENTIONS.md

## Module Registry
| Module | Responsibility | Key Entry Points |
|--------|---------------|-----------------|
| `lib/agents/` | Multi-agent orchestration loop — the core IP — and its background runner | `runPanelJob()` in runner.ts → `runPanel()` in orchestrator.ts |
| `lib/firebase/` | Firebase client (Auth only) + admin SDK init (lazy) | `getFirebaseAuth()`, `adminAuth()`, `adminDb()` |
| `lib/anthropic.ts` | Anthropic SDK client (lazy) | `getAnthropicClient()`, `DEFAULT_MODEL` |
| `lib/stripe.ts` | Stripe client (lazy) | `getStripe()` |
| `lib/billing/` | Free-run accounting | `reserveRun()`, `refundRun()` |
| `lib/limits/` | Per-account rate limits (abuse caps, Firestore fixed window) | `limitInTransaction()`, `limitResponse()` |
| `lib/account/` | Account deletion | `deleteAccount()` |
| `lib/mcp/` + `app/api/mcp` | MCP server for AI tools (Claude Code, Cursor) | `handleMessage()`, `askPanelServer()`, `verifyApiToken()` |
| `lib/panels/` | Stored panel state → SSE events | `diffPanel()` |
| `lib/auth.ts` | Session cookie helpers | `getSessionUser()`, `createSessionCookie()`, `verifySessionCookie()` |
| `lib/utils.ts` | className merge helper | `cn()` |
| `app/api/panels/` | Panel creation, SSE stream, export, retry | `POST /api/panels`, `GET .../stream`, `GET .../export`, `POST .../retry` |
| `app/api/context/` | Pro context extraction (URL + file) | `POST /api/context/extract`, `POST /api/context/upload` |
| `app/api/auth/session/` | Session cookie lifecycle | `POST`/`DELETE /api/auth/session` |
| `app/api/stripe/` | Checkout, billing portal, webhook | `POST create-checkout`, `POST portal`, `POST webhook` |
| `app/api/user/persona/` | Custom persona CRUD | `PUT`/`DELETE /api/user/persona` |
| `app/(app)/` | Auth-protected pages | dashboard, panel/[panelId], account, chat, chat/[cid] |
| `components/account/` | Billing portal redirect | BillingPortalButton |
| `lib/conversations/` | v2 conversation store, context, quick replies | `loadMessages()`, `toModelMessages()`, `debateContext()`, `streamReply()` |
| `app/api/conversations/` | v2 conversation API | `POST /api/conversations`, `POST …/[cid]/messages`, `POST …/[cid]/debates` |
| `app/(app)/chat/[cid]` + `components/chat/` | v2 conversation UI (the product since M4; /dashboard lists conversations) | `ConversationView`, `DebateBlock`, `ChatComposer`, `ProposalCard` |
| `app/(auth)/` | Sign-in/sign-up page | login |
| `app/p/[panelId]/` | Public share view (no auth) | — |
| `app/` (root) | Root layout + landing page | — |
| `components/panel/` | Panel UI — thread, composer, controls | PanelInput, PanelThread, AgentTurn, FinalAnswer, PersonaSelector, ContextInput, CustomPersonaEditor, FollowUpComposer, RetryButton, ShareDebateButton, SynthesisCard, ConfidenceBadge, QuestionBubble, PaywallDialog |
| `components/dashboard/` | Dashboard-specific composition | QuestionComposer, PanelList, RoundsSelector, StarterQuestions |
| `components/auth/` | Sign-in form + sign-out | AuthForm, SignOutButton |
| `components/ui/` | shadcn primitives | Button, Dialog, Badge, Card, Input, Label, Separator, Toaster, Textarea |
| `hooks/` | Client state | `useAuth()`, `usePanel()` |
| `scripts/e2e/` + `.github/workflows/ci.yml` | End-to-end suite (emulators + fake model API + Chromium) and CI (lint, unit, build, e2e) | `npm run e2e` → `run.sh` → `inner.sh` |
| `types/` | Shared domain types | `types/index.ts` (app-wide), `lib/agents/types.ts` (orchestrator-internal) |
| `proxy.ts` | Route protection middleware | protected: `/dashboard/*`, `/panel/*` |

## Internal Frameworks / Shared Libraries
| Framework | Responsibility | Used By |
|-----------|---------------|---------|
| SSE streaming | Live debate delivery: Firestore snapshots → `diffPanel()` → SSE; client reconnects and replays | PanelThread → usePanel → GET stream → onSnapshot |
| Run lease | One runner per panel; lease-checked writes; resume after crash | runner.ts, orchestrator.ts `leasedUpdate` |
| Firestore transactions | Atomic free-run limit + monthly reset enforcement | POST /api/panels |
| Prompt caching | `cache_control: ephemeral` on system prompts | orchestrator.ts (SACRED S003) |
| Lazy singleton clients | Prevents SSR/build-time crashes from missing env vars | lib/anthropic.ts, lib/stripe.ts, lib/firebase/* (SACRED S005) |
| Pro-gate UI pattern | Lock icon + click → PaywallDialog, consistent across every Pro-only control | PersonaSelector, RoundsSelector, ContextInput |

## Critical Business Logic Flows

### Panel Run (new panel) — background job since 2026-10-31
- Entry: `QuestionComposer` → `PanelInput.tsx` → `POST /api/panels` → `{ panelId }` → `router.push('/panel/[panelId]')`
- Creation: one transaction: `reserveRun()` (30-day reset → 5 free / 100 Pro → **counts the run**, both tiers; 402 free / 429 Pro at the limit) → clamp `maxRounds` by tier → copy custom persona → `tx.set()` panel with `status: 'queued'`, `runCounted` (SACRED S007 — doc exists before any stream opens)
- Start: `usePanel` opens `GET /api/panels/[panelId]/stream`; the route calls `runPanelJob(panelId)` detached — a no-op if a runner already holds a live lease
- Run: `runPanelJob` takes the lease (60s TTL, 15s heartbeat) → `runPanel()` resumes after the last stored step → Respondent (stream) → Critic (stream) → Synthesizer (`requestToolCall`: non-streaming `tool_use`, `tool_choice: auto` + strict, SACRED S002) → repeat up to clamped max rounds; every write is a lease-checked transaction (`leasedUpdate`); in-progress text flushed to `panel.live` ≤1/s
- Viewing: the stream route tails the doc with `onSnapshot` → `diffPanel()` → SSE events. Viewers never affect the run; any number can watch
- Termination: Synthesizer decision ≠ `'continue'`, or `isFinalRound` forces `'contested'` (SACRED S001)
- Post-complete (in the runner): `generatePanelTitle()` awaited; lease + live cleared. On error: `refundRun()`
- Hosting: `apphosting.yaml` `cpuAlwaysAllocated: true` keeps CPU for runs after the starting request ends; without it, runs stall while unwatched and resume on the next view

### Compare-options panel (2026-11-01, BL-043)
- Entry: dashboard ModeSelector "Compare options" or chat debate settings → `mode: 'compare'` through `createPanel` (stores `mode`, `compare: emptyCompare(options, revise)`). Optional typed options (2–3, `sanitizeOptions`) from the settings fields / MCP `options`; `revise` = Pro (BL-051)
- Run: `runPanelJob` → `runCompare`: n proposers (one per option, or 3) → critic → Pro: n revisions (round 2) → judge (`requestToolCall`, sees revised options) → complete with `finalAnswer`/`confidence` like critique, so lists, chat verdicts, title, export and sharing all work
- View: `diffCompare` → same SSE events (+ `index`, `compare_result`) → `panelReducer` → `ThreadView`; the share page replays the stored doc the same way (`stateFromPanel`)

### Follow-up Panel
- Entry: `FollowUpComposer` (rendered after `FinalAnswer` on a standalone completed panel) → `POST /api/panels` with `parentPanelId` + inherited `persona`. Starts **private** since 2026-11-01 (sharing is explicit; was inherited `isPublic`, BL-025)
- Context injection: parent panel's `finalAnswer` is fetched (ownership-checked, outside the transaction) and merged with any user-provided context, stored as `context` on the new panel doc, injected into the Respondent's round-1 prompt only

### Sharing a debate (2026-11-01, BL-049)
- Single debates only, never conversations. `ShareDebateButton` (chat `DebateBlock` once the verdict is in; panel page unless failed/stopped) → confirm → `PATCH /api/panels/[id] {isPublic}` → `setPanelSharing` (owner-only transaction) → `/p/[panelId]` renders it (complete panels only; 404 otherwise). Stop sharing flips it back; the link 404s.

### Leaving, Reconnecting, Crashes
- Leaving the page does not stop a run (it isn't tied to the request). A dropped connection is reopened by `usePanel` with backoff; each connection replays the full stored state through `diffPanel`.
- Two tabs / reconnects: the lease allows exactly one runner (verified: 3 concurrent `runPanelJob` calls → 1 run).
- Runner dies (deploy, instance shutdown): its lease expires after 60s; the next view starts a new runner that resumes at the first missing step (verified: killed mid-critic → resumed at critic, respondent not re-run). The client resets the regenerated turn on the repeated `agent_start`.
- A stale runner that wakes up after losing its lease gets `LeaseLostError` on its next write and exits without touching status.

### Conversation (v2; the dashboard since M4, 2026-11-01)
- New: dashboard composer → `POST /api/conversations` → `/chat/[cid]?q=…&mode=…` → page passes `pending` (only if empty) → `ConversationView` drops the params with `router.replace`, then sends
- Enter (coordinator, 2026-11-01): `POST …/messages {mode:'reply'}` → `reserveReply()` → reply model with `convene_panel`: text → streamed reply; tool call → Pro: debate starts (reason + Just answer shown) / free: proposal card (Run the panel → `…/[mid]/run`, Just answer → `…/[mid]/answer`). Decisions and overrides → `routingEvents`
- Debate (Debate button): `POST …/messages {mode:'debate'}` → `createPanel()` with `debateContext(history)` → runner starts immediately → assistant `kind:'debate'` message → `DebateBlock` renders `PanelThread` live
- Debate this: `POST …/debates {messageId}` → debates the user message that reply answered, with the conversation before it as context
- Later replies see finished debates as `[Panel verdict — …]` turns (read live from the panel docs by `loadMessages`)
- Debate settings: chip in the composer → persona + rounds, sent with Debate / Debate this, remembered on the conversation (`debateSettings`)
- Rolling summary (2026-11-01): after each reply, messages that left the window (last 60 within 24k chars) are folded into `conversation.summary` once ≥3k chars or ≥8 messages are waiting; until then they stay in the reply as slack. Replies = summary + unsummarized messages
- Stop: `POST /api/panels/[id]/stop` → panel `error` + `stoppedAt`, lease cleared → the runner's lease watch aborts the in-flight model call (streaming or Synthesizer) within ~1s. Free run refunded only before round 1's verdict

### Custom Persona
- Save: `CustomPersonaEditor` → `PUT /api/user/persona` (Pro-gated) → stored as `UserDoc.customPersona`
- Use: `PersonaSelector` selects `persona: 'custom'` → `POST /api/panels` copies the CURRENT saved `customPersona` onto the new panel doc's `PanelDoc.customPersona` at creation time → orchestrator never re-reads the user doc, only the panel doc (self-contained panel docs pattern, CONVENTIONS.md)
- Editing/deleting the saved persona later does NOT retroactively change already-created panels — each panel's copy is frozen at creation time

### v1 → v2 migration (2026-11-01, BL-044)
- Dashboard load → `migrateUserPanels(uid, v1MigratedAt?)` → panels without a conversation become conversations (chains together) → `listConversations`. /panel/[id] and /p/[id] unchanged

### Deletion (2026-11-01, BL-040)
- Panel: trash icon on /panel/[id] → `DELETE /api/panels/[id]` → stop if running (refund rule) → delete panel + its chat message
- Conversation: trash icon on /chat/[cid] → `DELETE /api/conversations/[cid]` → stop running debates → delete conversation (recursive) + its panels + late sweep
- Account: /account → type DELETE → `DELETE /api/account` → cancel live Stripe subscription (abort on failure) → delete panels, conversations, rate-limit docs, user doc → delete Auth user → sweep → cookie cleared; the runner of any running debate aborts when its doc disappears

### MCP (2026-11-01, BL-045)
- /account → create token (shown once) → client sends `Authorization: Bearer ap_…` to `POST /api/mcp` → `verifyApiToken` (hash lookup + Auth account check) → rate limit per message → `handleMessage` → `start_debate` (new conversation + `createPanel`) / `get_debate_result` (resume + snapshot wait)

### Auth Flow
- Login: Firebase Auth (Google OAuth / email) via `useAuth()` → ID token → `POST /api/auth/session` → verifies token, upserts user doc on first login, sets `__session` cookie (SACRED S006)
- Edge guard: `proxy.ts` checks cookie *presence* only on `/dashboard/*` and `/panel/*` (SACRED S008 — deliberately lightweight, no firebase-admin import)
- Deep guard: server components/route handlers call `getSessionUser()` for full cryptographic verification; `redirect('/login')` on `null` is the actual authority for invalid/expired cookies (see repo-rules.md, corrected 2026-09-14 per NR-001)

### Usage Limit & Monthly Reset
- Reserve: `reserveRun()` inside the creation (and retry) transaction: if the 30-day window passed, reset to 0 and advance `freeRunsResetAt`; then refuse at 5, else increment. Counting at creation closes the many-panels-before-any-completes bypass (verified: 12 concurrent → exactly 5)
- Refund: `refundRun()` when a run errors (idempotent via `panel.runCounted`)
- Paywall: 402 from `POST /api/panels` → `PaywallDialog` → `POST /api/stripe/create-checkout` → Stripe Checkout redirect
- Subscription sync: `checkout.session.completed` and `customer.subscription.created/updated/deleted` → webhook re-reads the subscription from Stripe → `subscriptionFields()` → tier (Pro for active/trialing/past_due), status, renewal date, cancelAtPeriodEnd. /account shows "Ends on" for scheduled cancellations and a failed-payment notice

## Technical Debt & Notes
- See `.memory/TECH_DEBT.md` for the full registry. TD-001, TD-003, TD-004 (SSRF DNS-rebinding gap, FollowUpComposer isPublic hardcoded, unused-but-buggy shared Textarea) were fixed 2026-09-15 (BL-024/025/026) — see the Resolved section. TD-002 (minor import style in api-auth) remains open, low severity.
- See `.memory/SACRED.md` (S001–S008) for behaviors that look wrong but are intentional — read before "cleaning up" anything that looks like an inconsistency in orchestrator.ts, lib/firebase/admin.ts, lib/auth.ts, proxy.ts, or the panel-creation/stream ordering.
