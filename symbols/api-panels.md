# Module: app/api/panels

**Responsibility:** Panel lifecycle — creation (with free-run/monthly-reset enforcement), SSE streaming with reconnection replay, retry, and Markdown export.

## Route Handlers

| Route | File | Responsibility |
|---|---|---|
| `POST /api/panels` | route.ts | Auth, question ≥10 chars, then `createPanel()` (lib/panels/create.ts) — 402 `FREE_LIMIT_REACHED` at the limit. The runner starts at creation. |
| `GET /api/panels/[panelId]/stream` | `[panelId]/stream/route.ts` | SSE. Auth + ownership. If `queued`/`running`, starts `runPanelJob()` detached (no-op while a lease is live). Then tails the panel doc with `onSnapshot` and converts each snapshot into SSE events via `diffPanel()` — the run never depends on this connection. Keep-alive comment every 15s; closes on `panel_complete`/`error`; cleans up on abort/cancel. |
| `GET /api/panels/[panelId]/export` | `[panelId]/export/route.ts` | Auth + ownership check. Requires `status === 'complete'` (409 otherwise). Formats the full panel (all rounds + final answer) as Markdown via internal `formatMarkdown()`, returns as a `Content-Disposition: attachment` download. |
| `POST /api/panels/[panelId]/retry` | `[panelId]/retry/route.ts` | One transaction: auth/ownership/`status === 'error'` checks, `reserveRun()` again (the failure was refunded; friendly 402 at the limit), resets rounds/answer/live/run, `runCounted`, `config.model`. The client's reconnect starts the new runner. |

## Internal Helpers

| Name | File | Responsibility |
|---|---|---|
| `diffPanel()` / `newCursor()` | `lib/panels/streamDiff.ts` | Replaced `replayRounds()` (2026-10-31): snapshot → SSE event diff; see `symbols/lib-panels.md` |
| `encodeSSE(event)` | stream/route.ts | Formats one `SSEEvent` as an `data: ...\n\n` SSE frame |
| `formatMarkdown(panel, panelId)` | export/route.ts | Builds the exported Markdown document: title, question, persona, date, confidence, per-round Respondent/Critic/Synthesis sections, Final Answer, attribution footer |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- `POST /api/panels` is the only place `maxRounds` is validated server-side — client-sent `maxRounds` is never trusted directly (clamped to tier limit inside the transaction). Confirmed correct: free tier cannot request 3 rounds even by crafting the request body directly.
- `GET /api/panels/[panelId]/stream` reads `panelData.customPersona ?? undefined` and passes it straight to `runPanel()` — depends on `POST /api/panels` having already resolved and copied it at creation time (see lib-agents notes / orchestrator `customPersona` param).
- Retry route clears `rounds: []` — a retry always starts the panel over from round 1, it does not resume from wherever it errored. This is a product decision, not a bug (an error mid-round means agent output for that round may be incomplete/untrustworthy).
