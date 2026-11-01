# Module: lib/panels

**Responsibility:** Creating panels, and turning stored panel state into the client's SSE event stream. Added 2026-10-31.

| Name | File | Responsibility |
|---|---|---|
| `PanelView` (type) | streamDiff.ts | The panel fields the diff reads |
| `StreamCursor` / `newCursor()` | streamDiff.ts | Per-connection record of emitted steps (`round:role` keys), the live turn being streamed (`agent`, `round`, `runId`, chars sent), and `done` |
| `diffPanel(cursor, panel)` | streamDiff.ts | Pure. Emits, in order: stored respondent/critic turns not yet sent (`agent_start`+`agent_complete`, or just `agent_complete` if it was streamed live), stored syntheses (`synthesis_start`+`synthesis_result`), then live text as `agent_token` deltas (re-sends `agent_start` + full text when the live `runId` changes or text shrinks = resumed run), then `panel_complete` or `error` (sets `done`). Same event shapes the orchestrator used to stream directly — client protocol unchanged. |

| `createPanel(input)` | create.ts | The only way to create a debate panel (composer route and conversations). Validates persona/context/follow-up parent, one transaction with `reserveRun()` + tier round clamp (1..2 free, 1..3 Pro) + custom-persona copy + **Pro-only personas fall back to General for free users** (was UI-only until 2026-11-01), writes `conversationId`/`messageId` when from a chat, then starts `runPanelJob()` immediately. Throws `FreeLimitReachedError`. |
| `stopPanel(panelId, uid)` / `StopRejected` | stop.ts | Owner's Stop (queued/running only; 404 not owner, 409 finished): one transaction sets `status: 'error'`, `errorMessage: STOPPED_MESSAGE`, `stoppedAt`, `run: null`, `live: null`; refunds via `refundRun` only if round 1 has no verdict (`firstRoundComplete`, spec §3.3). Returns `{ refunded }` = a run was actually given back. |
| `STOPPED_MESSAGE` | constants.ts | "You stopped this debate." — client-safe module (no server imports) |

## Notes
- Tests: `lib/panels/streamDiff.test.ts` (`npm test`).
- Live text arrives in ~1s chunks (runner flush interval, Firestore's ~1 write/sec/doc guidance), not per token.

2026-11-01 (BL-040):
| `deletePanel(panelId, uid)` / `stopIfRunning(panelId, uid)` | delete.ts | Owner-only delete of a panel and its chat message (batch); a queued/running debate is stopped first (Stop refund rule). `stopIfRunning` ignores only `StopRejected` (already finished) — other failures abort the delete rather than skip a refund |
| `listPanels(uid, cursor?)` / `PANEL_PAGE_SIZE` (20) | list.ts | Dashboard page, newest first, `orderBy(createdAt desc, __name__ desc)` (served by the existing userId+createdAt index). Returns `{ panels: PanelSummary[], next }`; `next` = exact `seconds.nanos.id` cursor, so deleting the cursor panel doesn't end paging |

2026-11-01 (BL-043):
- `diffPanel` branches to `diffCompare` for `mode: 'compare'`: stored proposals (keys `p0..p2`) and critic replay in order, then `synthesis_start` + `compare_result`, then live text (shared `liveEvents`, index-aware), then completion (`finish`).
- `panelReducer` / `initialPanelState` / `PanelAction` (panelState.ts, moved from hooks/usePanel.ts — pure, tested): turns matched by agent + round + index; `compare_result` → `state.comparison`.
- `stateFromPanel(panel)` (replay.ts, `.ts` imports so node:test loads it): stored panel → events → state. Used by the share page.
- `stopPanel` refund rule by mode: critique → before round 1's verdict; compare → before all options are in.
