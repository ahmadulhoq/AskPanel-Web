# Module: lib (root-level files)

**Responsibility:** Remaining cross-cutting lazy clients (Anthropic, Stripe) and shared helpers (session auth, className merge).

## Functions / Constants

| Name | File | Responsibility |
|---|---|---|
| `getAnthropicClient()` | anthropic.ts | Lazy singleton Anthropic SDK client |
| `DEFAULT_MODEL` (const) | anthropic.ts | `'claude-sonnet-4-5'` — the model used across all three agents (Respondent/Critic/Synthesizer) and title generation |
| `SESSION_COOKIE_NAME` (const) | auth.ts | `'__session'` — Firebase App Hosting convention, see SACRED S006 |
| `SESSION_DURATION_MS` (const) | auth.ts | 14 days |
| `createSessionCookie(idToken)` | auth.ts | Wraps `adminAuth().createSessionCookie()` |
| `verifySessionCookie(sessionCookie)` | auth.ts | Wraps `adminAuth().verifySessionCookie()`; returns `null` on any verification failure (never throws to caller) |
| `getSessionUser()` | auth.ts | **The single sanctioned way** to read the authenticated user server-side. Reads the `__session` cookie via `next/headers`, verifies it, returns the decoded token or `null`. Used by every protected server component and route handler. |
| `getStripe()` | stripe.ts | Lazy singleton Stripe client, pinned `apiVersion: '2026-04-22.dahlia'` |
| `cn(...inputs)` | utils.ts | shadcn's standard `clsx` + `tailwind-merge` composition helper — used in nearly every component for conditional className logic |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- All three client getters (`getAnthropicClient`, `getStripe`, plus the two in lib/firebase) follow the identical lazy-init shape — this is a deliberate, consistent pattern across the whole `lib/` layer, not incidental duplication. Do not "simplify" by extracting a generic factory — each has different construction args and error semantics.
