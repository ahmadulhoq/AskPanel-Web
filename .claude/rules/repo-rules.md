# AskPanel — Repo-Specific Rules

> This file is for project-specific rules unique to this repo.
> It is never overwritten by setup or sync.

## Stack Constraints
- **Next.js 15**: middleware is `proxy.ts`, export is named `proxy` (not `middleware`)
- **Firebase Admin**: private key env var requires `.replace(/\\n/g, '\n')` — see `lib/firebase/admin.ts`
- **Anthropic / Stripe / Firebase clients**: all lazy-initialized via getter functions to prevent SSR build failures
- **Node 25**: `.bin/` wrappers broken — invoke via `node node_modules/...` directly

## Agent Orchestration Rules
- The `isFinalRound` hard-guard in `orchestrator.ts` must never be removed — it prevents infinite loops when Synthesizer returns 'continue' on the last round
- Prompt caching (`cache_control: ephemeral`) on system prompts is intentional and cost-critical — do not remove
- Synthesizer uses `tool_use` (not streaming) — changing this breaks the structured output contract

## Auth Rules
- Session cookie name is `__session` (Firebase App Hosting convention)
- Never redirect to login inside server components — use the `proxy.ts` guard

## Firestore
- The composite index `panels: userId ASC + createdAt DESC` must exist before the dashboard query runs
- Free-run limit enforcement uses a Firestore transaction — never replace with a simple read+write
