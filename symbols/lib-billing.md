# Module: lib/billing

**Responsibility:** Free-run accounting. Added 2026-10-31.

| Name | File | Responsibility |
|---|---|---|
| `FREE_RUN_LIMIT` (const) | runs.ts | 5 per 30-day window |
| `FreeLimitReachedError` (class) | runs.ts | Thrown by `reserveRun` at the limit; routes map it to 402 |
| `reserveRun(tx, userRef, now)` | runs.ts | Inside the caller's transaction: reads the user (must be the transaction's first read of that doc), applies the monthly reset, enforces the limit, increments `freeRunsUsed`. Returns `{ tier, counted, userData }`. Pro: no count. Used by `POST /api/panels` and the retry route. |
| `refundRun(panelId)` | runs.ts | Transaction: if `panel.runCounted`, decrement the owner's `freeRunsUsed` (floor 0) and clear `runCounted`. Idempotent. Called by `runPanelJob` on error. |

## Notes
- Counting at creation (not completion) closes the bypass where a free user created many panels before any completed. Verified: 12 concurrent reservations at 0 → exactly 5 succeed.
- Firestore transactions need all reads before writes — call `reserveRun` before any `tx.set`/`tx.update` in the caller.
