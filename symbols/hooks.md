# Module: hooks

**Responsibility:** Client-side state — Firebase Auth subscription and live panel SSE state.

## Hooks

| Name | File | Responsibility |
|---|---|---|
| `useAuth()` | useAuth.ts | Subscribes to `onAuthStateChanged`. Exposes `user`, `loading`, `signInWithGoogle`, `signInWithEmail`, `signUpWithEmail`, `signOut`. Every sign-in method calls internal `exchangeTokenForSession(user)` after the Firebase client-side auth completes, POSTing the ID token to `/api/auth/session` to establish the server-side `__session` cookie. `signOut()` calls Firebase `signOut()` then `DELETE /api/auth/session`. |
| `usePanel(panelId)` | usePanel.ts | `useReducer`-backed. Opens an `EventSource` to `GET /api/panels/[panelId]/stream` on mount / panelId change, dispatches each parsed `SSEEvent` into the reducer, closes the stream on `panel_complete`/`error`. Reducer handles all 7 `SSEEvent` variants: `agent_start` (push new streaming turn), `agent_token` (append to the currently-streaming turn matching `agent`), `agent_complete` (finalize that turn's content, `streaming: false`), `synthesis_result` (push a `SynthesisState`), `panel_complete` (status → complete, store finalAnswer/confidence), `error` (status → error, store message). Malformed SSE JSON is silently ignored (`try/catch` around `JSON.parse`). |

## Internal Helpers

| Name | File | Responsibility |
|---|---|---|
| `exchangeTokenForSession(user)` | useAuth.ts | Gets the Firebase ID token and POSTs it to `/api/auth/session` |
| `reducer(state, action)` | usePanel.ts | The SSE-event-to-state reducer described above |
| `initialState()` | usePanel.ts | Returns the idle `PanelState` |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- `agent_token`'s targeting logic (`t.agent === action.agent && t.streaming`) matches by role + streaming flag, NOT by round number. This is safe only because exactly one turn can be `streaming: true` at a time per the orchestrator's sequential (never parallel) agent execution — worth knowing if the orchestration model ever changes to run agents concurrently, this reducer would need a round-aware match instead.
