# AskPanel — Project Rules

> Framework rules live in `.agents/rules/` (always active).
> This file is for **project-specific overrides and context** only.

## Project Context
AskPanel is a multi-agent AI deliberation web app. Users submit a question; three AI agents (Respondent, Critic, Synthesizer) debate it across up to 2 rounds and produce a stress-tested final answer with a confidence level (high/medium/low/contested).

**Stack:** Next.js 15 (App Router, TypeScript strict), Firebase Auth + Firestore + App Hosting, Anthropic Claude SDK (claude-sonnet-4-5), Stripe Checkout/webhooks.

**Core IP:** The orchestration loop in `lib/agents/orchestrator.ts` — SSE-streamed agent turns, Synthesizer using tool_use for structured JSON output, prompt caching via `cache_control: ephemeral`.

**Auth model:** Session cookies (Firebase Admin, 14-day, HttpOnly). Protected routes via `proxy.ts` (Next.js 15 renames middleware.ts → proxy.ts, export `proxy`).

**Business model:** 5 free runs lifetime, then $15/mo Pro via Stripe. Run limit enforced via Firestore transaction in `POST /api/panels`.

## Project Rules
<!-- Ad-hoc rules specific to this project. -->
