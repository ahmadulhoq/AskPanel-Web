# Project Map: askpanel-web
> Last updated: 2026-09-14T00:00Z by Cartographer Agent

## Architecture Pattern
- Pattern: Next.js 15 App Router — Server Components for data, Client Components pushed to the leaves (verified against current Next.js 15 best practice via web search, Sept 2026)
- Auth: Firebase Auth (client SDK for sign-in) + session cookies verified via Firebase Admin SDK (server-side)
- DB: Firestore (NoSQL document model) — Admin SDK only, no direct client-side Firestore access in app code
- UI: Tailwind CSS v4 + shadcn/ui (built on `@base-ui/react` primitives + `class-variance-authority`)
- Navigation: Next.js App Router file-based routing, incl. route groups `(app)` (protected) and `(auth)` (public)
- Serialization boundary: server components map Firestore documents (which carry `Timestamp` objects) to plain serializable types before passing props to client components — see CONVENTIONS.md

## Module Registry
| Module | Responsibility | Key Entry Points |
|--------|---------------|-----------------|
| `lib/agents/` | Multi-agent orchestration loop — the core IP | `runPanel()` in orchestrator.ts |
| `lib/firebase/` | Firebase client + admin SDK init (lazy) | `getFirebaseAuth()`, `getFirebaseDb()`, `adminAuth()`, `adminDb()` |
| `lib/anthropic.ts` | Anthropic SDK client (lazy) | `getAnthropicClient()`, `DEFAULT_MODEL` |
| `lib/stripe.ts` | Stripe client (lazy) | `getStripe()` |
| `lib/auth.ts` | Session cookie helpers | `getSessionUser()`, `createSessionCookie()`, `verifySessionCookie()` |
| `lib/utils.ts` | className merge helper | `cn()` |
| `app/api/panels/` | Panel creation, SSE stream, export, retry | `POST /api/panels`, `GET .../stream`, `GET .../export`, `POST .../retry` |
| `app/api/context/` | Pro context extraction (URL + file) | `POST /api/context/extract`, `POST /api/context/upload` |
| `app/api/auth/session/` | Session cookie lifecycle | `POST`/`DELETE /api/auth/session` |
| `app/api/stripe/` | Checkout, billing portal, webhook | `POST create-checkout`, `POST portal`, `POST webhook` |
| `app/api/user/persona/` | Custom persona CRUD | `PUT`/`DELETE /api/user/persona` |
| `app/(app)/` | Auth-protected pages | dashboard, panel/[panelId], account |
| `components/account/` | Billing portal redirect | BillingPortalButton |
| `app/(auth)/` | Sign-in/sign-up page | login |
| `app/p/[panelId]/` | Public share view (no auth) | — |
| `app/` (root) | Root layout + landing page | — |
| `components/panel/` | Panel UI — thread, composer, controls | PanelInput, PanelThread, AgentTurn, FinalAnswer, PersonaSelector, ContextInput, CustomPersonaEditor, FollowUpComposer, RetryButton, ShareButton, SynthesisCard, ConfidenceBadge, QuestionBubble, PaywallDialog |
| `components/dashboard/` | Dashboard-specific composition | QuestionComposer, PanelList, RoundsSelector, StarterQuestions |
| `components/auth/` | Sign-in form + sign-out | AuthForm, SignOutButton |
| `components/ui/` | shadcn primitives | Button, Dialog, Badge, Card, Input, Label, Separator, Toaster, Textarea |
| `hooks/` | Client state | `useAuth()`, `usePanel()` |
| `types/` | Shared domain types | `types/index.ts` (app-wide), `lib/agents/types.ts` (orchestrator-internal) |
| `proxy.ts` | Route protection middleware | protected: `/dashboard/*`, `/panel/*` |

## Internal Frameworks / Shared Libraries
| Framework | Responsibility | Used By |
|-----------|---------------|---------|
| SSE streaming | Real-time agent token delivery + reconnection replay | PanelThread → usePanel → GET stream → `replayRounds()` |
| Firestore transactions | Atomic free-run limit + monthly reset enforcement | POST /api/panels |
| Prompt caching | `cache_control: ephemeral` on system prompts | orchestrator.ts (SACRED S003) |
| Lazy singleton clients | Prevents SSR/build-time crashes from missing env vars | lib/anthropic.ts, lib/stripe.ts, lib/firebase/* (SACRED S005) |
| Pro-gate UI pattern | Lock icon + click → PaywallDialog, consistent across every Pro-only control | PersonaSelector, RoundsSelector, ContextInput |

## Critical Business Logic Flows

### Panel Run (new panel)
- Entry: `QuestionComposer` → `PanelInput.tsx` → `POST /api/panels` → `{ panelId }` → `router.push('/panel/[panelId]')`
- Creation: transaction reads user doc → applies monthly free-run reset if due → enforces 5-run free limit (402 if exceeded) → validates `maxRounds` per tier → resolves `customPersona` if `persona === 'custom'` → `tx.set()` panel doc with `status: 'queued'` (SACRED S007 — doc exists before stream ever opens)
- Stream: `usePanel` opens `GET /api/panels/[panelId]/stream` (EventSource)
- Orchestration: `runPanel()` → Respondent (stream) → Critic (stream) → Synthesizer (`tool_use`, SACRED S002) → repeat up to `config.maxRounds` (1–3, tier-validated)
- Termination: Synthesizer decision ≠ `'continue'`, or `isFinalRound` forces `'contested'` (SACRED S001)
- Persistence: each agent turn written to Firestore `rounds[]` array as it completes; `status`/`finalAnswer`/`confidence` updated on complete
- Post-complete: `freeRunsUsed` incremented for non-pro users; `generatePanelTitle()` fired (not awaited)

### Follow-up Panel
- Entry: `FollowUpComposer` (rendered after `FinalAnswer` on a completed panel) → `POST /api/panels` with `parentPanelId` + inherited `persona` + inherited `isPublic` (`panel.isPublic` threaded down from `PanelPage`, fixed 2026-09-15 BL-025 — see TECH_DEBT.md Resolved TD-003)
- Context injection: parent panel's `finalAnswer` is fetched (ownership-checked, outside the transaction) and merged with any user-provided context, stored as `context` on the new panel doc, injected into the Respondent's round-1 prompt only

### SSE Reconnection / Page Refresh Mid-Run
- `GET /api/panels/[panelId]/stream` always calls `replayRounds(panelData.rounds ?? [])` first — converts already-persisted rounds back into synthetic SSE events — before either (a) emitting `panel_complete` immediately (if `status === 'complete'`) or (b) continuing with the live `runPanel()` generator (if still queued/running)
- This means a client that disconnects and reconnects mid-run sees the full thread reconstructed from Firestore, then picks up live events from wherever the orchestrator actually is

### Custom Persona
- Save: `CustomPersonaEditor` → `PUT /api/user/persona` (Pro-gated) → stored as `UserDoc.customPersona`
- Use: `PersonaSelector` selects `persona: 'custom'` → `POST /api/panels` copies the CURRENT saved `customPersona` onto the new panel doc's `PanelDoc.customPersona` at creation time → orchestrator never re-reads the user doc, only the panel doc (self-contained panel docs pattern, CONVENTIONS.md)
- Editing/deleting the saved persona later does NOT retroactively change already-created panels — each panel's copy is frozen at creation time

### Auth Flow
- Login: Firebase Auth (Google OAuth / email) via `useAuth()` → ID token → `POST /api/auth/session` → verifies token, upserts user doc on first login, sets `__session` cookie (SACRED S006)
- Edge guard: `proxy.ts` checks cookie *presence* only on `/dashboard/*` and `/panel/*` (SACRED S008 — deliberately lightweight, no firebase-admin import)
- Deep guard: server components/route handlers call `getSessionUser()` for full cryptographic verification; `redirect('/login')` on `null` is the actual authority for invalid/expired cookies (see repo-rules.md, corrected 2026-09-14 per NR-001)

### Usage Limit & Monthly Reset
- Check: Firestore transaction in `POST /api/panels`: if `tier !== 'pro'` and `(resetAt === 0 || now >= resetAt)`, zero `freeRunsUsed` and advance `freeRunsResetAt` by 30 days, THEN check `freeRunsUsed >= 5` against the (possibly just-reset) value
- Increment: stream route increments `freeRunsUsed` on `panel_complete` for non-pro users
- Paywall: 402 from `POST /api/panels` → `PaywallDialog` → `POST /api/stripe/create-checkout` → Stripe Checkout redirect
- Upgrade: `checkout.session.completed` webhook → `tier: 'pro'` on user doc
- Downgrade: `customer.subscription.deleted` webhook → `tier: 'free'`

## Technical Debt & Notes
- See `.memory/TECH_DEBT.md` for the full registry. TD-001, TD-003, TD-004 (SSRF DNS-rebinding gap, FollowUpComposer isPublic hardcoded, unused-but-buggy shared Textarea) were fixed 2026-09-15 (BL-024/025/026) — see the Resolved section. TD-002 (minor import style in api-auth) remains open, low severity.
- See `.memory/SACRED.md` (S001–S008) for behaviors that look wrong but are intentional — read before "cleaning up" anything that looks like an inconsistency in orchestrator.ts, lib/firebase/admin.ts, lib/auth.ts, proxy.ts, or the panel-creation/stream ordering.
