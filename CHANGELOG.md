# Agent Changelog: askpanel-web

## 2026-11-01 — BL-044: conversations become the product, v2 M4 (PR #8)

- Dashboard = composer + conversation list; v1 panels migrate on first visit (chains → one conversation; idempotent; late panels picked up); Pro context attachments in chat; "debates" wording; /chat redirects; v1 composer/list removed.
- Self-review: 10 findings fixed — a big attachment could wipe a debate's brief, "Debate this" dropped attachments, attachment + brief overflowed 4000; migration flag set despite failures (v1 panels then unreachable); concurrent migrations double-counted; BulkWriter errors unhandled; panel deletion failed when its conversation was gone; counts negative/missing (now recounted); assistant docs duplicated attachments; extra reads on every dashboard load.
- Also found while testing: awaiting BulkWriter writes before close() deadlocks (writes are sent on flush/close).
- e2e: 20 runner scenarios, 40 browser checks; unit 57.

## 2026-11-01 — BL-042: coordinator auto-routing, v2 M2 (PR #7)

- The reply model decides when to convene the panel (`convene_panel`); Pro auto-starts, free gets a Run / Just answer card; "Just answer" on a running coordinator debate stops it and answers; all decisions/overrides logged to `routingEvents`.
- Self-review: 10 findings fixed — notably deleting a stopped panel could delete the "Just answer" reply (panel still pointed at the message), double clicks could run/charge or stream twice (now transactional claims), an unusable tool call failed the reply (now falls back), a debate finishing during "Just answer" lost its verdict.
- e2e: 19 runner scenarios, 35 browser checks (incl. concurrent "Just answer" → 200/409); unit 51.

## 2026-11-01 — BL-043: compare-options mode, v2 M3 (PR #6)

- Proposers ×3 → Critic → Judge (`tool_use`, winner + scores), one round, resumable, Stop-aware. Critique loop untouched.
- Refactors that came with it: client reducer → `lib/panels/panelState.ts` (pure, tested); thread rendering → `ThreadView`, shared with the share page, which now replays stored panels through diff + reducer instead of its own reconstruction.
- Self-review: 9 findings fixed — notably compare runs were always refunded on Stop (now count once all options are in), tokens lacked the proposer index, Judge could be cut off at 1500 tokens.
- e2e: 19 runner scenarios, 27 browser checks; unit 47. Follow-ups in BL-051.

## 2026-11-01 — BL-040: launch basics (PR #5)

- /privacy + /terms (drafts written from the code; legal details → BL-050), footer links; delete account / panel / conversation; dashboard "Show more" with an exact cursor; per-account rate limits counted inside the reservation transactions.
- Self-review found 9 issues, all fixed: deleting an account with an already-cancelled subscription would fail forever; per-IP sign-in limit bypassable via X-Forwarded-For and harmful behind shared IPs (now per account, after verification); failed attempts counted toward limits; panels created mid-deletion survived; deleted cursor ended paging; dashboard list ignored server refreshes; swallowed stop errors could skip refunds; duplicated try/catch.
- Found by looking at screenshots: dashboard, chat list and account pages had shrunk to their content width (flex body + mx-auto) — pre-existing; fixed with w-full.
- e2e: 16 runner scenarios, 24 browser checks; unit 38.

## 2026-11-01 — BL-048: chat debate settings, Stop, rolling summary (PR #4)

- Persona/rounds for chat debates (composer chip + panel; remembered per conversation). Stop (route, runner lease watch + AbortSignal through the orchestrator so even the Synthesizer call is cancelled; refund only before round 1's verdict). Rolling summary (in-memory backlog after each reply; summary not counted against the reply budget; unsummarized slack stays visible).
- Found and fixed: Pro-only personas were enforced only in the UI — `createPanel` now falls back to General for free users.
- Self-review found 10 issues, all fixed: stoppedAt not cleared on retry; local "Connection lost" marked debates failed; 409 Stop labelled finished debates "stopped"; `refunded` true for Pro; Synthesizer call not aborted; summarizer re-read 200 messages per reply; messages invisible between leaving the window and being summarized; summary-length window mismatch; "Debate this" on an old reply leaked later turns via the summary; sequential reads on /chat.
- e2e: 12 runner scenarios, 17 browser checks; unit tests 35.

## 2026-11-01 — BL-038: CI, e2e suite in the repo, lint, paywall wording (PR #3)

- Git flow changed at the user's request: PR per piece of work, self-review, CI green, merge. PR #3 merged as `8590093` (merge commit — keeps two superseded 2026-05-31 docs commits from the session branch in history without reapplying them).
- Lint clean: CustomPersonaEditor form moved inside the dialog content (remounts on open) instead of setState in an effect; PaywallDialog quote; unused DELETE param.
- PaywallDialog `reason` prop: locked Pro controls now say "That’s a Pro feature" (audit #9). Pro feature list untouched — "100 runs / month" waits on BL-035.
- `scripts/e2e/` + `npm run e2e`: the M0/M1 harness, self-contained (throwaway key, own emulator user, firebase emulators:exec). 7 scenarios + 14 browser checks. Builds into `.next-e2e` (`NEXT_DIST_DIR` in next.config.ts).
- `.github/workflows/ci.yml`: lint, unit tests, build; e2e job (Java 21, Playwright 1.56.1 installed with --no-save). Both jobs green on GitHub (≈2 and ≈3 min).
- Self-review (code-review skill) found 10 items; fixed 8 (orphaned child runner on scenario failure, transaction retries under 12-way contention, e2e build clobbering .next, fake server crash on bad JSON, .tsx hook mismatch, duplicated scroller lookup, a check hard-coded to pass). Skipped: "paywall dropped the feature list" (it didn't), custom-persona role detection in the fake (documented).

## 2026-10-31 — BL-034, BL-036, BL-039, v2 M1 (chat), font fix

- BL-034 (`2f4848f`): PanelInput submit callback was missing `persona`/`parentPanelId` deps → a persona picked after typing was ignored.
- BL-036 (`350a1e3`): Stripe webhook now handles checkout.session.completed + customer.subscription.created/updated/deleted by re-reading the subscription from Stripe (order-proof); status→tier mapping tested (past_due keeps Pro as a grace period); uid stamped on subscriptions; existing customers reused; 409 on double checkout; /account shows scheduled cancellation and failed payment. Not exercised against Stripe (no keys) — `stripe trigger` test filed under BL-003.
- BL-039 (`3868256`): Streamdown replaces react-markdown (removed, with remark-gfm). The `prose` classes had been no-ops (no typography plugin), so answers rendered unstyled. ThreadScroller (use-stick-to-bottom) on the panel page.
- v2 M1 backend (`f776c78`): `lib/panels/create.ts` (shared creation; runner starts at creation; rounds clamp bug fixed), conversations + messages, quick-reply SSE from POST (detached generation), debate from message, Debate this, context builder (tested), reply cap 30/day (placeholder), titles, index.
- v2 M1 UI (`3d42432`): /chat and /chat/[cid], ChatComposer, AssistantReply, DebateBlock, ConversationView; PanelThread `showFollowUp`/`onComplete`; ThreadScroller `followKey`; /chat protected in proxy.ts.
- Font (`53c6258`): `--font-sans: var(--font-sans)` was self-referential → whole app rendered in the default serif. Now Geist.
- Verification: 25 unit tests (`npm test`); browser e2e (13 checks) in Chromium against Firestore + Auth emulators with real login and a fake model API — panel streaming + scroll, markdown styling, chat reply, Debate this, Debate button, debate finishing after the user left, persistence, phone width, no console errors. Recipe in RULES.md.

## 2026-10-31 — M0: security lockdown + background debate runs; v2 spec

- **Audit (2026-10-30)** found: client-writable Firestore rules (self-upgrade to Pro, reset run count, arbitrary model/rounds run at our cost); Next.js 16.2.6 critical RCE advisories; debates dying on client disconnect (verified: Next aborts the response stream → enqueue throws → generator torn down) and restarting from round 1 with duplicates and double billing on return; free-limit bypass (checked at creation, counted at completion); title generation cut off after the response.
- **Step 1 (`b795596`)**: `firestore.rules` deny all client access; `runPanel` uses `DEFAULT_MODEL` and clamps rounds to 1..3; next/eslint-config-next → 16.4.3 (no documented breaking changes in 16.3/16.4; verified incremental streaming under 16.4's native Node streams); `npm audit fix` → 0 critical (4 remaining highs: gRPC *server* advisories in the browser Firebase SDK's Firestore path, unreachable; npm's "fix" is a downgrade); removed unused client `getFirebaseDb`; `firebase.json` now deploys the composite index.
- **Step 2 (`c7d0593`)**: `runPanelJob` runner with lease/heartbeat, resumable lease-checked orchestrator, Firestore-tailing stream route (`diffPanel`), reconnecting `usePanel`, reserve-at-creation/refund-on-error run accounting (`lib/billing/runs.ts`), `cpuAlwaysAllocated: true`. First automated tests (`npm test`, node:test, 11 tests). Verified end to end against the Firestore emulator + a fake Anthropic API (7 scenarios, all pass). Not verified: the HTTP stream route under real Firebase Auth, and the live Anthropic API.
- **Spec (`5b74e2a`)**: `docs/engineering/plans/v2-conversational-spec.md` — conversational product with coordinator tool, compare-options mode, MCP distribution; milestones M1–M5.
- Not modified: SACRED.md. S007's rule still holds, but its description references the removed `replayRounds()` — wording update needs user approval.

## 2026-10-05 — BL-030: model migration to claude-sonnet-5-5

- User delegated the choice. Picked `claude-sonnet-5-5`: newest Sonnet in SDK 0.131, same tier/cost class as Sonnet 4.5, longest runway before deprecation, used in the SDK's own examples. No request-shape changes needed.
- Retry route now resets `config.model` to `DEFAULT_MODEL` — panels pin their model at creation, so an old errored panel retried after 2026-11-30 would otherwise hit the retired model.
- Updated the architecture doc's model references. Filed BL-031 (P1): post-deploy smoke test of every persona, since no live API call was possible here.
- DA-005 resolved.

## 2026-10-05 — BL-028 SDK upgrade, proxy /account fix, memory reconciliation

- BL-028: `@anthropic-ai/sdk` ^0.98.0 → ^0.131.0. Changelog 0.98–0.131 reviewed: no breaking changes to `messages.create` streaming, `tools`/`tool_choice`, or `cache_control`. tsc + build pass. Not verified against the live API (no key in this environment).
- **New P0 (BL-030 / DA-005):** SDK 0.131 lists `claude-sonnet-4-5` — our `DEFAULT_MODEL` — as deprecated with end-of-life 2026-11-30. Left unchanged: replacement choice is a user decision.
- BL-029 (firebase-admin 13→14, major): trial-installed 14.5.0, tsc + build pass with no code changes; reverted. Awaiting approval + confirmation the App Hosting runtime is Node ≥22.
- `proxy.ts`: added `/account` to `PROTECTED` and `matcher` (missed in BL-023); replaced the stale "edge bundle" comment. Same wording fix in both repo-rules.md copies.
- TD-002 resolved (merged duplicate imports in auth/session route).
- Memory reconciliation: `.memory/BACKLOG.md` now mirrors the canonical root `BACKLOG.md`; RULES.md records the mirror rule, direct-to-main flow, RESUME.md non-durability, the two repo-rules copies, and corrected stack/business-model context (Next.js 16, 1–3 rounds, monthly free-run reset). Fixed remaining "Next.js 15" in MAP.md, CONVENTIONS.md, RULES.md, symbols/root-config.md.

## 2026-09-15 — BL-024–027: security fix + two bug fixes + doc corrections

- BL-024: closed the SSRF DNS-rebinding gap in `app/api/context/extract` — resolves hostname via `dns.promises.lookup()` and checks every returned IP; switched to manual redirect handling (`redirect: 'manual'`) so each hop is independently re-validated before being followed (fetch's automatic redirect-following previously bypassed the hostname check entirely)
- BL-025: `FollowUpComposer` now inherits the parent panel's `isPublic` (threaded `PanelPage` → `PanelThread` → `FollowUpComposer`) instead of hardcoding `true`
- BL-026: removed `field-sizing-content` from the shared `components/ui/textarea.tsx` — the property that caused this project's original jumping-textarea bug; it's still unused but no longer a landmine
- BL-027: corrected "Next.js 15" → "Next.js 16" and the false "Node 25" claim across `.claude/rules/repo-rules.md`, `.agents/rules/repo-rules.md` (also brought its auth-rule wording in sync with the S008/NR-001 fix, which had only reached the `.claude/` copy), `AGENTS.md`, `docs/engineering/plans/mvp-architecture.md`
- TECH_DEBT.md: TD-001, TD-003, TD-004 moved to Resolved; DEPENDENCY_ALERTS.md: DA-001, DA-002 moved to Resolved
- BACKLOG.md: BL-024–027 moved to Done

## 2026-09-14 — BL-023: usage/billing account page

- New `/account` page (server component): shows current tier, free-run count + reset date, or Pro renewal date
- `POST /api/stripe/portal`: creates a Stripe Billing Portal session for Pro users with a `stripeCustomerId`
- `BillingPortalButton` client component redirects to the returned portal URL
- Dashboard header gets an "Account" link
- Committed to `main` directly (ee14b0e) per confirmed direct-to-main flow
- BACKLOG.md: moved BL-021, BL-022, BL-023 to Done (were shipped earlier this session but not previously marked); added BL-024–BL-027 from cartography TECH_DEBT/DEPENDENCY_ALERTS findings

## 2026-09-14 — Full cartography pass

- Mapped all 19 modules / 61 source files (split-symbols mode) — `.memory/symbols/*.md`, `SYMBOLS.md` index, `MAP.md` architecture doc
- Populated `CONVENTIONS.md` from observed patterns + a Next.js 16 best-practice check (server-components-for-data / client-leaves confirmed as current best practice)
- Formalized 8 SACRED entries (S001-S008) from existing human-authored rules in `.claude/rules/repo-rules.md`, plus one new one (S008, from NR-001 triage) covering why server components still `redirect('/login')` despite `proxy.ts` existing
- Logged 4 TECH_DEBT entries: TD-001 (SSRF DNS-rebinding gap in context/extract), TD-002 (minor import style), TD-003 (FollowUpComposer hardcodes isPublic:true), TD-004 (unused shared Textarea primitive still carries the original jumping-textarea bug)
- Wrote LESSONS.md Lesson 001 — the shared `components/ui/textarea.tsx` still has the `field-sizing-content` bug that was the very first issue fixed in this project's history; it's just unused, not actually fixed
- Triaged NR-001 (auth-rule-vs-code contradiction) with the user — resolved as "rule wording was wrong" — separately committed a 1-line fix to `.claude/rules/repo-rules.md` on `main` (commit b839463)
- Populated `VERSIONS.md` with real installed versions and `DEPENDENCY_ALERTS.md` with 4 open alerts (DA-001 through DA-004) — most notably: this repo's docs say "Next.js 15" throughout but the actual running version is **16.2.6**, and `proxy.ts` is a Next.js 16 feature (Node.js runtime, not edge) — the stale "edge bundle size" comment in `proxy.ts` may need a follow-up look
- Flipped `CONFIG.md` Status: pilot → active

## 2026-05-24 — Initial agentic setup via setup-skeleton workflow

- Installed agentskel v1.57.0 on askpanel-web
- Created ai-memory orphan branch and .memory/ worktree
- Initialised memory files: CONFIG, RULES, MAP, SYMBOLS, RESUME, VERSIONS, CONVENTIONS, SACRED, TECH_DEBT, NEEDS_REVIEW, LESSONS, CHANGELOG, TIME_LOG, DEPENDENCY_ALERTS, DEPENDENCY_HISTORY, BACKLOG
- Created .agents/ structure: rules, workflows, skills, standards (web platform)
- Created .claude/ structure: rules, skills stubs, hooks, settings.json
- Created .agent symlink for Antigravity
- Added AGENTS.md, CLAUDE.md, GEMINI.md, .claudeignore
- Added .github/CODEOWNERS, scripts/install-agent.sh
- GitHub: ahmadulhoq/AskPanel-Web
