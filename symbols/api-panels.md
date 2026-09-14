# Module: app/api/panels

**Responsibility:** Panel lifecycle — creation (with free-run/monthly-reset enforcement), SSE streaming with reconnection replay, retry, and Markdown export.

## Route Handlers

| Route | File | Responsibility |
|---|---|---|
| `POST /api/panels` | route.ts | Creates a panel doc. Validates question length (≥10 chars), persona key (falls back to `'general'`, allows `'custom'`), sanitises `userContext` (4000-char cap). Resolves follow-up context from `parentPanelId` (ownership-checked, outside the transaction). Merges user context + follow-up context. Inside one Firestore transaction: reads user doc, applies monthly free-run reset if `freeRunsResetAt` has passed, enforces the 5-run free limit (throws `FREE_LIMIT_REACHED` → 402), validates `maxRounds` against tier (free ≤2, pro ≤3), resolves and copies custom persona prompts onto the panel doc if `persona === 'custom'` (falls back to `'general'` if no custom persona saved), then `tx.set()`s the panel doc with `status: 'queued'`. |
| `GET /api/panels/[panelId]/stream` | `[panelId]/stream/route.ts` | SSE stream. Auth + ownership check. If panel already `status: 'complete'`, replays all stored rounds via `replayRounds()` generator then emits `panel_complete` — no orchestrator call. If queued/running, replays stored rounds first (reconnection support), then continues with the live `runPanel()` generator, forwarding events. On `panel_complete`: increments `freeRunsUsed` for non-pro users, fires `generatePanelTitle()` (not awaited). |
| `GET /api/panels/[panelId]/export` | `[panelId]/export/route.ts` | Auth + ownership check. Requires `status === 'complete'` (409 otherwise). Formats the full panel (all rounds + final answer) as Markdown via internal `formatMarkdown()`, returns as a `Content-Disposition: attachment` download. |
| `POST /api/panels/[panelId]/retry` | `[panelId]/retry/route.ts` | Auth + ownership check. Requires `status === 'error'` (409 otherwise). Resets the panel doc: `status: 'queued'`, clears `errorMessage`/`rounds`/`finalAnswer`/`confidence`/`completedAt`. Client is expected to reload/reconnect the SSE stream afterward — this route does not itself start the orchestrator. |

## Internal Helpers

| Name | File | Responsibility |
|---|---|---|
| `replayRounds(rounds)` | stream/route.ts | Generator — converts persisted `PanelRound[]` back into the same SSE event shapes the live orchestrator would have emitted (`agent_start`/`agent_complete`/`synthesis_start`/`synthesis_result`). See SACRED S007. |
| `encodeSSE(event)` | stream/route.ts | Formats one `SSEEvent` as an `data: ...\n\n` SSE frame |
| `formatMarkdown(panel, panelId)` | export/route.ts | Builds the exported Markdown document: title, question, persona, date, confidence, per-round Respondent/Critic/Synthesis sections, Final Answer, attribution footer |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- `POST /api/panels` is the only place `maxRounds` is validated server-side — client-sent `maxRounds` is never trusted directly (clamped to tier limit inside the transaction). Confirmed correct: free tier cannot request 3 rounds even by crafting the request body directly.
- `GET /api/panels/[panelId]/stream` reads `panelData.customPersona ?? undefined` and passes it straight to `runPanel()` — depends on `POST /api/panels` having already resolved and copied it at creation time (see lib-agents notes / orchestrator `customPersona` param).
- Retry route clears `rounds: []` — a retry always starts the panel over from round 1, it does not resume from wherever it errored. This is a product decision, not a bug (an error mid-round means agent output for that round may be incomplete/untrustworthy).
