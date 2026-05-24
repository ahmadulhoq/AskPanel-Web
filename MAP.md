# Project Map: askpanel-web
> Last updated: [UTC_TIMESTAMP] by Cartographer Agent

## Architecture Pattern
- Pattern: Next.js App Router (server components + client components)
- Auth: Firebase Auth + session cookies (Firebase Admin SDK)
- DB: Firestore (NoSQL document model)
- UI: Tailwind CSS + shadcn/ui
- Navigation: Next.js App Router file-based routing

## Module Registry
| Module | Responsibility | Key Entry Points |
|--------|---------------|-----------------|
| `lib/agents/` | Multi-agent orchestration loop | `runPanel()` in orchestrator.ts |
| `lib/firebase/` | Firebase client + admin SDK init | `getFirebaseAuth()`, `adminDb()` |
| `lib/anthropic.ts` | Anthropic SDK client | `getAnthropicClient()` |
| `lib/stripe.ts` | Stripe client | `getStripe()` |
| `lib/auth.ts` | Session cookie helpers | `getSessionUser()` |
| `app/api/panels/` | Panel creation + SSE stream | POST /api/panels, GET /api/panels/[id]/stream |
| `app/api/auth/session/` | Session cookie management | POST/DELETE /api/auth/session |
| `app/api/stripe/` | Stripe checkout + webhooks | POST create-checkout, POST webhook |
| `app/(app)/` | Auth-protected pages | dashboard, panel/[panelId] |
| `app/p/[panelId]/` | Public share view | no auth required |
| `components/panel/` | Panel UI components | PanelInput, PanelThread, AgentTurn, FinalAnswer |
| `hooks/` | Client state | usePanel (SSE), useAuth |
| `proxy.ts` | Route protection middleware | protected: /dashboard/*, /panel/* |

## Internal Frameworks / Shared Libraries
| Framework | Responsibility | Used By |
|-----------|---------------|---------|
| SSE streaming | Real-time agent token delivery | PanelThread → usePanel → GET stream |
| Firestore transactions | Atomic free-run limit enforcement | POST /api/panels |
| Prompt caching | cache_control: ephemeral on system prompts | orchestrator.ts |

## Critical Business Logic Flows

### Panel Run
- Entry: `PanelInput.tsx` → POST /api/panels → `{ panelId }` → navigate to /panel/[panelId]
- Stream: `usePanel` opens GET /api/panels/[panelId]/stream SSE
- Orchestration: `runPanel()` → Respondent (stream) → Critic (stream) → Synthesizer (tool_use) → repeat up to maxRounds=2
- Termination: Synthesizer decision ≠ 'continue', or isFinalRound forces 'contested'
- Persistence: each agent turn written to Firestore `rounds[]` array; status/finalAnswer/confidence updated on complete

### Auth Flow
- Login: Firebase Auth (Google OAuth / email) → ID token → POST /api/auth/session → session cookie
- Guard: `proxy.ts` verifies session cookie via `firebase-admin.verifySessionCookie()` on protected routes
- Server components: `getSessionUser()` reads cookie directly via Admin SDK

### Usage Limit
- Check: Firestore transaction in POST /api/panels: `freeRunsUsed < 5 || tier === 'pro'`
- Increment: GET stream route increments `freeRunsUsed` on `panel_complete` event
- Paywall: 402 from POST /api/panels → `PaywallDialog` → Stripe Checkout

## Technical Debt & Notes
- _(Agent appends findings here as it works — see also TECH_DEBT.md)_
