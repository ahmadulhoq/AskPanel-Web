# AskPanel — Project Rules

> Framework rules live in `.agents/rules/` (always active).
> This file is for **project-specific overrides and context** only.

## Project Context
AskPanel is a multi-agent AI deliberation web app. Users submit a question; three AI agents (Respondent, Critic, Synthesizer) debate it across 1–3 rounds (user-selectable; free tier capped at 2, Pro at 3, enforced server-side) and produce a stress-tested final answer with a confidence level (high/medium/low/contested). Five built-in personas plus a Pro custom persona shape the Respondent/Critic prompts.

**Stack:** Next.js 16 (App Router, TypeScript strict), Firebase Auth + Firestore + App Hosting, Anthropic Claude SDK (claude-sonnet-5-5), Stripe Checkout/webhooks.

**Core IP:** The orchestration loop in `lib/agents/orchestrator.ts` — SSE-streamed agent turns, Synthesizer using tool_use for structured JSON output, prompt caching via `cache_control: ephemeral`.

**Auth model:** Session cookies (Firebase Admin, 14-day, HttpOnly). Protected routes via `proxy.ts` (Next.js 16 renames middleware.ts → proxy.ts, export `proxy`; runs on the Node runtime).

**Business model:** 5 free runs per 30-day window (reset via `freeRunsResetAt`, applied inside the same Firestore transaction that enforces the limit in `POST /api/panels`), then $15/mo Pro via Stripe. Pro unlocks all personas, custom persona, 3 rounds, URL/file context, and Markdown export.

## Project Rules
<!-- Ad-hoc rules specific to this project. -->
- **Backlog:** the project-root `BACKLOG.md` is canonical (user-facing, committed to `main`). `.memory/BACKLOG.md` is a mirror for the session-start/task-completion skills — overwrite it from the root copy at task-completion, never edit it independently.
- **Git flow (since 2026-11-01):** one PR per piece of work from the session branch → self-review (code-review skill) → fix findings → CI green (lint, unit, build, e2e) → merge. The user asked for this on 2026-11-01, replacing direct-to-`main` (2026-09-14). After a merge, reset the session branch onto `origin/main` before the next piece. PR #3 (BL-038) used a merge commit to keep two superseded May docs commits from the session branch in history; later PRs can squash.
- **RESUME.md is not durable here:** it's gitignored on `ai-memory` and each session runs in a fresh container, so it does not survive between sessions. Reconstruct state from `CHANGELOG.md`, `BACKLOG.md`, and `git log`.
- **Repo rules exist in two copies** (`.claude/rules/repo-rules.md` and `.agents/rules/repo-rules.md`, not symlinked). Edit both identically and `diff` them afterward.
- **Model:** `DEFAULT_MODEL` (`lib/anthropic.ts`) is `claude-sonnet-5-5` (migrated from Sonnet 4.5 on 2026-10-05, BL-030 — user delegated the choice). Since 2026-10-31 the runner always uses the current `DEFAULT_MODEL` and records it in `config.model`, so stored panels can't pin a retired model. On future model changes, check the SDK's `DEPRECATED_MODELS` table in `node_modules/@anthropic-ai/sdk/resources/messages/messages.js`.
- **BulkWriter:** attach a handler to each write promise as you queue it and `await writer.close()` before awaiting them — writes are only sent on flush/close, so awaiting them first deadlocks (found 2026-11-01).
- **Browser never touches Firestore.** `firestore.rules` deny all client reads/writes (2026-10-31). All data access goes through server routes with the Admin SDK. Don't add client Firestore calls or loosen the rules.
- **Debates run as background jobs.** Only `runPanelJob()` (lib/agents/runner.ts) runs the orchestrator — never inside a request's response stream. Stream routes only watch Firestore. All panel progress writes go through the lease check.
- **Tests:** `npm test` (node:test with type stripping, no extra deps); `npm run e2e` (scripts/e2e: Firebase emulators + fake model API + Chromium — 7 runner scenarios, 14 browser checks); CI (`.github/workflows/ci.yml`) runs lint, unit, build and e2e on every PR and push to main. Testable modules must be pure and import only types from `@/…`; tests import siblings with the `.ts` extension.
- **Fonts:** `app/globals.css` maps `--font-sans` to `--font-geist-sans` (set by `app/layout.tsx`). It was self-referential until 2026-10-31, which silently rendered the whole app in the browser's default serif.
- **End-to-end verification:** `npm run e2e` (committed 2026-11-01, BL-038). It runs `firebase emulators:exec` on the `demo-askpanel` project (emulator ports in firebase.json: Firestore 8085, Auth 9099) → `scripts/e2e/inner.sh`: generates a throwaway Admin key, starts `fake-anthropic.mjs` (127.0.0.1:8099; `/__control`, `/__stats`, `/__reset`), runs `scenarios.mjs` (Node with `register.mjs` hooks that resolve `@/` and extensionless imports), builds into `.next-e2e`, `next start` on 3917, then `browser.mjs` (signs up its own emulator user, takes the `__session` cookie from `/api/auth/session`). In this container: Java 21 is present; Playwright resolves from the global install via NODE_PATH; `npx firebase-tools@15.34.2` works (or set `FIREBASE_CLI`); the Firestore emulator jar (v1.22.0 for that CLI) caches in `~/.cache/firebase/emulators`. `E2E_SKIP_BUILD=1` reuses `.next-e2e`. Output/screenshots in `e2e-results/`. Gotchas: `next start` re-execs as `next-server` (the script kills whole process groups); never `pkill -f` a pattern that appears in your own command line.

