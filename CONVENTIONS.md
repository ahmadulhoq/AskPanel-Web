# Coding Conventions: askpanel-web

<!-- Observed project-specific patterns and conventions.
     Populated by the cartographer agent during codebase mapping.
     Agent must follow these patterns when editing existing code. -->

## Naming Patterns
- Components: PascalCase file + named export matching filename (`PanelInput.tsx` → `export function PanelInput`)
- API routes: `app/api/<resource>/route.ts` (collection) or `app/api/<resource>/[id]/<action>/route.ts` (item action) — verbs as path segments, not query params (`retry`, `export`, `stream`)
- Client-only components are always marked `'use client'` at file top; server components have no directive
- Hooks: `use*.ts` in `hooks/`, one hook per file, returns a reducer-backed state object (see `usePanel.ts`)
- Types: all shared domain types centralized in `types/index.ts` (not scattered per-feature) — SSE event unions, Firestore doc shapes, client-side state shapes all live here
- Agent-internal types (`ConversationTurn`, `OrchestratorInput`) live in `lib/agents/types.ts`, separate from the app-wide `types/index.ts`

## Architecture Patterns
- **Server Components for data, Client Components pushed to the leaves** — matches current Next.js 15 best practice (verified via web search, Sept 2026: "push 'use client' as far down the tree as possible"). Example: `app/(app)/dashboard/page.tsx` is a server component that reads Firestore directly and passes plain serialized props to client leaves (`QuestionComposer`, `PanelList`); it never becomes a client component itself.
- **Firestore Timestamp serialization boundary** — server components must NOT pass raw Firestore `Timestamp` objects as props to client components (not JSON-serializable across the RSC boundary in a way client code can use). Convention: map to a plain summary type first (see `PanelList`'s `PanelSummary` type, `formatResetDate()` helper in dashboard page converting `Timestamp` → formatted string server-side).
- **Lazy client initialization** — Anthropic, Stripe, and Firebase (both client and admin) SDKs are never instantiated at module scope. Each exposes a `get*Client()` / `adminDb()` getter that constructs-and-caches on first call. This prevents build-time (SSR/static-generation) crashes from missing env vars during `next build`. Never revert to top-level `new Anthropic(...)`-style instantiation.
- **Persist-before-stream** — panel documents are created in Firestore (`status: 'queued'`) synchronously in `POST /api/panels` before the SSE stream ever opens. The stream route re-reads that doc and can replay stored rounds. This makes reconnection and page-refresh mid-run recoverable — never restructure to create the Firestore doc lazily inside the stream handler.
- **SSE reconnection replay** — `GET /api/panels/[panelId]/stream` has a `replayRounds()` generator that turns already-persisted Firestore `rounds[]` entries back into synthetic SSE events before continuing with (or in place of) the live orchestrator generator. Any new event type added to the live orchestrator must also be handled in `replayRounds()` or reconnecting clients will silently miss it.
- **Self-contained panel docs** — data needed to resume/replay a panel run (persona, custom persona prompts, injected context, maxRounds) is copied onto the panel document at creation time rather than re-read from the user doc during orchestration. Keeps the orchestrator's only dependency the panel doc itself.
- **Firestore transactions for anything counting toward a limit** — free-run enforcement and the monthly reset both happen inside one `db.runTransaction()` in `POST /api/panels`, never as separate read-then-write calls (race condition risk under concurrent requests).

## Common Utilities
- `lib/auth.ts` → `getSessionUser()` — the only sanctioned way to read the authenticated user in a server component or route handler; wraps Firebase Admin `verifySessionCookie()`.
- `lib/firebase/admin.ts` → `adminDb()` — lazy Firestore Admin client getter.
- `lib/anthropic.ts` → `getAnthropicClient()`, `DEFAULT_MODEL` constant (`claude-sonnet-4-5`).
- `lib/utils.ts` → `cn()` (shadcn's clsx+tailwind-merge helper), used in every component for conditional className composition.
- Pro-gated UI pattern: every Pro-only affordance (persona lock, rounds selector round 3, context input, custom persona) follows the same shape — a lock icon + `onClick` opens `<PaywallDialog>` rather than disabling the control outright.

## Third-Party Library Usage
- **Anthropic SDK**: `messages.create({ stream: true })` for Respondent/Critic (token-by-token SSE forwarding); `messages.create({ tools: [...], tool_choice: { type: 'any' } })` (non-streaming) for the Synthesizer, which must return structured JSON via `tool_use` — never convert the Synthesizer to streaming text, it would break the structured-output contract (see `.claude/rules/repo-rules.md` / SACRED).
- **Prompt caching**: every agent's `system` prompt is sent as `[{ type: 'text', text: ..., cache_control: { type: 'ephemeral' } }]`. This is cost-critical (system prompts are large and repeated every round) — never remove `cache_control` when touching prompt-building code.
- **Firebase**: client SDK (`lib/firebase/client.ts`) is browser-only, used by `useAuth`/`AuthForm` for sign-in; Admin SDK (`lib/firebase/admin.ts`) is server-only, used everywhere else (session verification, all Firestore reads/writes). They are never imported into the same file.
- **Stripe**: `lib/stripe.ts` lazy client; webhook route (`app/api/stripe/webhook/route.ts`) verifies signature before trusting payload (standard Stripe webhook security requirement — do not relax).
- **pdf-parse** (added for BL-021, 2026-09): modern class-based API (`import { PDFParse } from 'pdf-parse'`, not the older function-style `pdf-parse`), dynamically imported inside the upload route handler to avoid any module-scope filesystem access at build time.
