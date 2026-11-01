# Module: lib/billing

**Responsibility:** Usage accounting (debate runs, quick replies) and Stripe subscription mapping. Added 2026-10-31.

| Name | File | Responsibility |
|---|---|---|
| `FREE_RUN_LIMIT` / `PRO_RUN_LIMIT` / `runLimit(tier)` / `Tier` | runs.ts | 5 free, 100 Pro (BL-035, 2026-11-01) per 30-day window, one shared counter (`freeRunsUsed`, v1 name kept) |
| `RunLimitReachedError` → `FreeLimitReachedError` / `ProLimitReachedError` (classes) | runs.ts | Thrown by `reserveRun` at the limit, with `resetAt`. Free → 402 (upgrade dialog); Pro → 429 + `proLimitMessage(resetAt)` (`panelErrorResponse`, retry route, MCP text) |
| `proLimitMessage(resetAt)` / `resetDateLabel(resetAt)` | runs.ts | "You've used your 100 debates for this month. More from <date>." (server time zone) |
| `reserveRun(tx, userRef, now)` | runs.ts | Inside the caller's transaction: reads the user (must be the transaction's first read of that doc), applies the 30-day reset, enforces the tier's limit, increments `freeRunsUsed` — **both tiers** since 2026-11-01. Returns `{ tier, userData, windowEndsAt }`; callers store `runCounted: true` + `runWindowEndsAt`. Used by `createPanel` and the retry route. |
| `allowance(userData, now)` | runs.ts | For display: `{ tier, limit, left, resetAt }`; an expired window counts as reset (`resetAt` null). Dashboard + account |
| `refundRun(panelId)` | runs.ts | Transaction: if `panel.runCounted`, decrement the owner's `freeRunsUsed` (floor 0) — only if the user's window is still the one in `panel.runWindowEndsAt` (absent = legacy, refunded) — and clear `runCounted`. Idempotent. Returns whether a run was given back. Called by `runPanelJob` on error and by `stopPanel`. |

| `subscriptionFields(sub)` | subscription.ts | Pure (tested). Stripe subscription → `{ tier, status, subscriptionId, customerId, currentPeriodEndMs, cancelAtPeriodEnd }`. Pro for active/trialing/past_due (past_due = grace while Stripe retries); free otherwise. Period end read from `items.data[0]` (this API version). |
| `shouldApply(currentSubId, incoming)` | subscription.ts | Pure (tested). Ignores events about an older subscription unless the incoming one is paying (out-of-order safety). |
| `allowanceOnTierChange(from, to)` | subscription.ts | Pure (tested). Pro → free resets `freeRunsUsed`/`freeRunsResetAt` (user decision 2026-11-01: fresh 5 when Pro ends); applied in the Stripe webhook transaction |
| `FREE_DAILY_REPLIES` / `reserveReply(tx, userRef, now)` / `ReplyLimitReachedError` | replies.ts | Free users: 30 quick replies per 24h window (`repliesUsed`, `repliesResetAt` on the user doc) — decided (BL-047). Pro: no daily cap (per-minute rate limit still applies). |

## Notes
- Counting at creation (not completion) closes the bypass where a free user created many panels before any completed. Verified: 12 concurrent reservations at 0 → exactly 5 succeed.
- Firestore transactions need all reads before writes — call `reserveRun` before any `tx.set`/`tx.update` in the caller.
