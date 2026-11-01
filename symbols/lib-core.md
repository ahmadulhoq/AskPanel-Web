# Module: lib (root-level files)

**Responsibility:** Remaining cross-cutting lazy clients (Anthropic, Stripe) and shared helpers (session auth, className merge).

## Functions / Constants

| Name | File | Responsibility |
|---|---|---|
| `getAnthropicClient()` | anthropic.ts | Lazy singleton Anthropic SDK client |
| `DEFAULT_MODEL` (const) | anthropic.ts | `'claude-sonnet-5-5'` (since 2026-10-05; was `claude-sonnet-4-5`, EOL 2026-11-30) — the model used across all three agents (Respondent/Critic/Synthesizer) and title generation |
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

## 2026-11-01 (BL-040)
- `lib/limits/window.ts` — `decide(state, limit, now)`: pure fixed-window counter (tested).
- `lib/limits/rateLimit.ts` — `LIMITS` (debate 20/h, reply 20/min, context 30/h, session 30/10min), all **per account** (not per IP: X-Forwarded-For isn't trustworthy without the proxy chain, and shared IPs would lock users out). `limitInTransaction(tx, name, uid)` reads + returns the counting write, so the count lands only if the rest of the caller's transaction succeeds (used in createPanel, retry, replies). `rateLimit(name, uid)`, `limitResponse(name, uid)` (429 Response or null), `RateLimitedError`, `rateLimitedResponse`. Docs `rateLimits/{name}:{uid}` with `uid` and `expiresAt` (needs a Firestore TTL policy — BL-002 notes).
- `lib/account/delete.ts` — `deleteAccount(uid)`: cancels a Stripe subscription that can still bill (retrieve first; already-ended ones skipped; failure → `AccountDeletionError`, nothing deleted), deletes panels, conversations (recursive), rate-limit docs, user doc, then the Auth user, then sweeps again for panels created by in-flight requests.
- `lib/legal.ts` — `LEGAL` (operator, contactEmail, governingLaw: null until BL-050) and `legalDraft`.
