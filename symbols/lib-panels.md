# Module: lib/panels

**Responsibility:** Turning stored panel state into the client's SSE event stream. Added 2026-10-31.

| Name | File | Responsibility |
|---|---|---|
| `PanelView` (type) | streamDiff.ts | The panel fields the diff reads |
| `StreamCursor` / `newCursor()` | streamDiff.ts | Per-connection record of emitted steps (`round:role` keys), the live turn being streamed (`agent`, `round`, `runId`, chars sent), and `done` |
| `diffPanel(cursor, panel)` | streamDiff.ts | Pure. Emits, in order: stored respondent/critic turns not yet sent (`agent_start`+`agent_complete`, or just `agent_complete` if it was streamed live), stored syntheses (`synthesis_start`+`synthesis_result`), then live text as `agent_token` deltas (re-sends `agent_start` + full text when the live `runId` changes or text shrinks = resumed run), then `panel_complete` or `error` (sets `done`). Same event shapes the orchestrator used to stream directly — client protocol unchanged. |

## Notes
- Tests: `lib/panels/streamDiff.test.ts` (`npm test`).
- Live text arrives in ~1s chunks (runner flush interval, Firestore's ~1 write/sec/doc guidance), not per token.
