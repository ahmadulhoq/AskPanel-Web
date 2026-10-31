# Module: lib/billing

**Responsibility:** Usage accounting (debate runs, quick replies) and Stripe subscription mapping. Added 2026-10-31.

| Name | File | Responsibility |
|---|---|---|
| `FREE_RUN_LIMIT` (const) | runs.ts | 5 per 30-day window |
| `FreeLimitReachedError` (class) | runs.ts | Thrown by `reserveRun` at the limit; routes map it to 402 |
| `reserveRun(tx, userRef, now)` | runs.ts | Inside the caller's transaction: reads the user (must be the transaction's first read of that doc), applies the monthly reset, enforces the limit, increments `freeRunsUsed`. Returns `{ tier, counted, userData }`. Pro: no count. Used by `POST /api/panels` and the retry route. |
| `refundRun(panelId)` | runs.ts | Transaction: if `panel.runCounted`, decrement the owner's `freeRunsUsed` (floor 0) and clear `runCounted`. Idempotent. Called by `runPanelJob` on error. |

| `subscriptionFields(sub)` | subscription.ts | Pure (tested). Stripe subscription → `{ tier, status, subscriptionId, customerId, currentPeriodEndMs, cancelAtPeriodEnd }`. Pro for active/trialing/past_due (past_due = grace while Stripe retries); free otherwise. Period end read from `items.data[0]` (this API version). |
| `shouldApply(currentSubId, incoming)` | subscription.ts | Pure (tested). Ignores events about an older subscription unless the incoming one is paying (out-of-order safety). |
| `FREE_DAILY_REPLIES` / `reserveReply(tx, userRef, now)` / `ReplyLimitReachedError` | replies.ts | Free users: 30 quick replies per 24h window (`repliesUsed`, `repliesResetAt` on the user doc). Placeholder pending pricing (v2 spec §13.2). Pro unlimited. |

## Notes
- Counting at creation (not completion) closes the bypass where a free user created many panels before any completed. Verified: 12 concurrent reservations at 0 → exactly 5 succeed.
- Firestore transactions need all reads before writes — call `reserveRun` before any `tx.set`/`tx.update` in the caller.
