# Sacred Behaviors — Do Not Modify

<!-- Records behaviors, workarounds, or patterns that look wrong but exist
     for a reason. The agent must never modify or refactor anything listed
     here without explicit human approval.

     The agent never decides something is sacred on its own. See Triage
     Protocol for classification rules.

     Format: ## SNNN — [Short Description]
     Include: Location, What it looks like, Why it exists, Confidence,
              Added by, Rule -->

## S001 — isFinalRound hard guard against 'continue'

- **Location:** `lib/agents/orchestrator.ts`, `runPanel()`, end of the per-round loop
- **What it looks like:** After the Synthesizer call, if `isFinalRound && synthesis.decision === 'continue'`, the code forcibly overwrites `decision` to `'contested'` (and bumps confidence to `'low'` if not already set). Looks like it's second-guessing the Synthesizer's own output.
- **Why it exists:** Without this guard, a Synthesizer that keeps returning `'continue'` on the last allowed round would leave the panel in an unresolved state — there is no round `maxRounds + 1` to actually continue into. This is the loop-termination safety net.
- **Confidence:** High — explicitly documented as non-negotiable in `.claude/rules/repo-rules.md` ("must never be removed — it prevents infinite loops").
- **Added by:** cartographer (2026-09-14), formalizing an existing human-authored rule
- **Rule:** Never remove or weaken this guard. If round-limit behavior needs to change, change `config.maxRounds` validation, not this guard.

## S002 — Verdicts use one non-streaming tool call, not streamed text

- **Location:** `lib/agents/orchestrator.ts` — `requestToolCall()`, used by `callSynthesizer()` and by the compare Judge (`lib/agents/compare.ts`)
- **What it looks like:** Respondent, Critic and Proposers stream token-by-token (`streamAgent()`), but the Synthesizer and the Judge each make one non-streaming call with a strict tool (`SYNTHESIZER_TOOL`, `JUDGE_TOOL`) and `tool_choice: { type: 'auto' }`. Inconsistent with the other agents at first glance, and "auto" can look like it should be a forced choice.
- **Why it exists:** Verdicts must be structured, parseable JSON (`decision`, `confidence`, `reasoning`, `issuesFound`, `finalAnswer`; the Judge's `winner`/`scores`). Parsing partial JSON out of streamed text is unreliable. Claude Sonnet 5.5 rejects a forced `tool_choice` (`any`/`tool`) with a 400, so the tool call is secured by: a strict schema (`strict: true`, `additionalProperties: false`), a system-prompt rule to always call the tool, one retry that keeps the text answer and tells the model to call the tool, and validation (`parseSynthesis()` / `parseJudgement()`). A call cut off at `max_tokens` or refused is not retried.
- **Confidence:** High — documented in `.claude/rules/repo-rules.md` ("changing this breaks the structured output contract"); the forced-choice 400 is in the Sonnet 5.5 migration guide and enforced by the e2e fake (BL-053, PR #10).
- **Added by:** cartographer (2026-09-14); wording updated 2026-11-01 with user approval (forced `tool_choice` → `auto` + strict, PR #10)
- **Rule:** Never convert verdicts to streaming text output, and never reinstate a forced `tool_choice` on Claude Sonnet 5.5 or later — it fails every debate. If lower latency is needed, look at model choice, effort or prompt length, not the tool_use mechanism.

## S003 — cache_control: ephemeral on every agent system prompt

- **Location:** `lib/agents/orchestrator.ts` (`streamAgent()`, `callSynthesizer()`) — every `system` array wraps its text block in `cache_control: { type: 'ephemeral' }`
- **What it looks like:** Extra wrapper object around what could just be a plain string `system` prompt.
- **Why it exists:** Persona system prompts are large (multi-paragraph) and sent unchanged on every round of every panel run. Prompt caching means only the dynamic `user` message costs full input-token price after the first call within the cache TTL — this is a meaningful, deliberate cost optimization.
- **Confidence:** High — explicitly documented in `.claude/rules/repo-rules.md` ("intentional and cost-critical — do not remove").
- **Added by:** cartographer (2026-09-14)
- **Rule:** Never strip `cache_control` when refactoring prompt-building code, even if it looks like unnecessary ceremony.

## S004 — Firebase Admin private key newline replacement

- **Location:** `lib/firebase/admin.ts`, `getAdminApp()`: `process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')`
- **What it looks like:** A regex replace on an env var that looks like it shouldn't be necessary.
- **Why it exists:** Firebase Admin service account private keys are multi-line PEM strings. Most env var storage (including Firebase App Hosting's `apphosting.yaml` / Secret Manager) can't hold literal newlines cleanly, so the key is stored with `\n` escape sequences and must be unescaped at runtime before `cert()` will accept it.
- **Confidence:** High — explicitly documented in `.claude/rules/repo-rules.md` (repo-rules.md calls this out by name as a stack constraint).
- **Added by:** cartographer (2026-09-14)
- **Rule:** Never remove this `.replace()` call or "simplify" private key handling without testing an actual deploy — silent auth failures are the failure mode if this regresses.

## S005 — Lazy singleton pattern for all external SDK clients

- **Location:** `lib/anthropic.ts`, `lib/stripe.ts`, `lib/firebase/admin.ts`, `lib/firebase/client.ts` — every one exposes a `get*()` / `*Db()` / `*Auth()` function with a module-level `let` cache, never a top-level `new Client(...)` or `export const client = ...`
- **What it looks like:** Boilerplate indirection — could look like it should be simplified to a plain exported instance.
- **Why it exists:** Next.js evaluates route/page modules during `next build` (static analysis / prerendering). A top-level client instantiation that reads `process.env.SOME_KEY!` would throw at build time in any environment where that secret isn't present at build (e.g. CI, or a build step that doesn't have runtime secrets injected). Lazy construction defers the env var read to actual request time.
- **Confidence:** High — explicitly documented in `.claude/rules/repo-rules.md` ("all lazy-initialized via getter functions to prevent SSR build failures").
- **Added by:** cartographer (2026-09-14)
- **Rule:** Any new external SDK client added to this codebase must follow the same lazy-getter pattern. Never instantiate a client at module scope.

## S006 — Session cookie name is `__session`, not a custom name

- **Location:** `lib/auth.ts`, `SESSION_COOKIE_NAME = '__session'`
- **What it looks like:** An oddly generic, double-underscore-prefixed cookie name where a project-specific name (e.g. `askpanel_session`) might be expected.
- **Why it exists:** Firebase App Hosting (Cloud Run under the hood) has specific conventions/reserved behavior around the `__session` cookie name for session-based auth patterns. Renaming it can break the hosting platform's handling of the cookie.
- **Confidence:** High — explicitly documented in `.claude/rules/repo-rules.md` ("Firebase App Hosting convention").
- **Added by:** cartographer (2026-09-14)
- **Rule:** Never rename this cookie without first confirming Firebase App Hosting's current documented behavior for session cookies.

## S008 — Server-component `redirect('/login')` handles what proxy.ts intentionally skips

- **Location:** `app/(app)/layout.tsx` and `app/(app)/panel/[panelId]/page.tsx` — both call `redirect('/login')` when `getSessionUser()` returns `null`
- **What it looks like:** Contradicts the literal wording of `.claude/rules/repo-rules.md`'s Auth Rules ("Never redirect to login inside server components — use the proxy.ts guard"), so it could look like a rule violation waiting to be "cleaned up."
- **Why it exists:** `proxy.ts` deliberately does a lightweight check only — cookie *presence*, not cryptographic *validity* (its own comment: "we avoid importing [firebase-admin] in middleware to keep edge bundle small"). A present-but-invalid cookie (expired, tampered, revoked, or a user Firestore doc deleted) passes `proxy.ts` and only fails in `getSessionUser()`'s full `verifySessionCookie()` call inside the server component. The server-component redirect is the only thing that catches that case — it is defense-in-depth, not redundant with `proxy.ts`.
- **Confidence:** High — resolved via user triage (NR-001, 2026-09-14): "Rule wording is wrong, code is correct."
- **Added by:** cartographer (2026-09-14), triaged with user
- **Rule:** Do not remove these `redirect('/login')` calls to "match" the written rule. Instead, `.claude/rules/repo-rules.md`'s wording should be corrected (flagged separately — see CHANGELOG) to: "proxy.ts only checks cookie presence, not validity, to keep the edge bundle small. Server components/route handlers must still redirect on `getSessionUser() === null` to catch invalid/expired cookies."

## S007 — Persist first: the panel doc exists before any run or stream

- **Location:** `lib/panels/create.ts` `createPanel()` — writes the panel doc (`status: 'queued'`) in a transaction, then starts `runPanelJob()` (`lib/agents/runner.ts`); `GET /api/panels/[panelId]/stream` only watches Firestore
- **What it looks like:** Could look simplifiable — "why not create the doc when the stream opens, or run the debate inside the stream handler?"
- **Why it exists:** Debates run in the background under a lease (`runPanelJob`) and survive the viewer leaving. The stream route and the share page rebuild everything from what is stored (`diffPanel()` in `lib/panels/streamDiff.ts`, `stateFromPanel()` in `lib/panels/replay.ts`), so page refresh, SSE reconnect, a second tab and MCP polling all work, and a missing doc means "doesn't exist", never "not started yet".
- **Confidence:** High — matches `.claude/rules/repo-rules.md` ("Debates run only through `runPanelJob()` … Stream routes only watch Firestore") and `.memory/RULES.md`.
- **Added by:** cartographer (2026-09-14); wording updated 2026-11-01 with user approval (background runner replaced the in-stream orchestrator and `replayRounds()`)
- **Rule:** Never create the panel doc lazily in the stream handler, and never run the orchestrator inside a response stream.
