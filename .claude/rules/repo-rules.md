# AskPanel — Repo-Specific Rules

> This file is for project-specific rules unique to this repo.
> It is never overwritten by setup or sync.

## Stack Constraints
- **Next.js 16**: middleware is `proxy.ts`, export is named `proxy` (not `middleware`) — this is a Next.js 16 feature, runs on the Node.js runtime (not edge)
- **Firebase Admin**: private key env var requires `.replace(/\\n/g, '\n')` — see `lib/firebase/admin.ts`
- **Anthropic / Stripe / Firebase clients**: all lazy-initialized via getter functions to prevent SSR build failures
- **Node.js**: no version pinned via `.nvmrc`/`engines.node`; `.bin/` wrappers are broken in this environment regardless of version — invoke via `node node_modules/...` directly

## Agent Orchestration Rules
- The `isFinalRound` hard-guard in `orchestrator.ts` must never be removed — it prevents infinite loops when Synthesizer returns 'continue' on the last round
- Prompt caching (`cache_control: ephemeral`) on system prompts is intentional and cost-critical — do not remove
- Synthesizer uses `tool_use` (not streaming) — changing this breaks the structured output contract

## Auth Rules
- Session cookie name is `__session` (Firebase App Hosting convention)
- `proxy.ts` only checks cookie *presence*, not validity — it deliberately avoids importing `firebase-admin` to keep the edge bundle small. It does NOT catch an expired/tampered/revoked cookie. Server components and route handlers must still redirect to `/login` when `getSessionUser()` returns `null` (e.g. `app/(app)/layout.tsx`, `app/(app)/panel/[panelId]/page.tsx`) — that redirect is load-bearing defense-in-depth, not redundant with `proxy.ts`. See `.memory/SACRED.md` S008.

## Firestore
- The composite index `panels: userId ASC + createdAt DESC` must exist before the dashboard query runs
- Free-run limit enforcement uses a Firestore transaction — never replace with a simple read+write
