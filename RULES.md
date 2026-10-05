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
- **Git flow:** direct-to-`main`, no PR gate (user decision 2026-09-14), overriding the skeleton's default PR-required git-flow.
- **RESUME.md is not durable here:** it's gitignored on `ai-memory` and each session runs in a fresh container, so it does not survive between sessions. Reconstruct state from `CHANGELOG.md`, `BACKLOG.md`, and `git log`.
- **Repo rules exist in two copies** (`.claude/rules/repo-rules.md` and `.agents/rules/repo-rules.md`, not symlinked). Edit both identically and `diff` them afterward.
- **Model:** `DEFAULT_MODEL` (`lib/anthropic.ts`) is `claude-sonnet-5-5` (migrated from Sonnet 4.5 on 2026-10-05, BL-030 — user delegated the choice). Panels pin `config.model` at creation; the retry route resets it to `DEFAULT_MODEL`. On future model changes, check the SDK's `DEPRECATED_MODELS` table in `node_modules/@anthropic-ai/sdk/resources/messages/messages.js`.
