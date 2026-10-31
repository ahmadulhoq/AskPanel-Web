# Module: hooks

**Responsibility:** Client-side state — Firebase Auth subscription and live panel SSE state.

## Hooks

| Name | File | Responsibility |
|---|---|---|
| `useAuth()` | useAuth.ts | Subscribes to `onAuthStateChanged`. Exposes `user`, `loading`, `signInWithGoogle`, `signInWithEmail`, `signUpWithEmail`, `signOut`. Every sign-in method calls internal `exchangeTokenForSession(user)` after the Firebase client-side auth completes, POSTing the ID token to `/api/auth/session` to establish the server-side `__session` cookie. `signOut()` calls Firebase `signOut()` then `DELETE /api/auth/session`. |
| `usePanel(panelId)` | usePanel.ts | `useReducer`-backed SSE client. Opens `GET /api/panels/[panelId]/stream`; on a dropped connection reconnects with exponential backoff (max 5 attempts, then 'Connection lost'), resetting state on the first event of each connection (no flash) because every connection replays full stored state. Closes on `panel_complete`/`error`. Reducer: `agent_start` replaces an existing *streaming* turn for the same agent+round (a resumed run regenerating it) instead of duplicating; other events as before. |

## Internal Helpers

| Name | File | Responsibility |
|---|---|---|
| `exchangeTokenForSession(user)` | useAuth.ts | Gets the Firebase ID token and POSTs it to `/api/auth/session` |
| `reducer(state, action)` | usePanel.ts | The SSE-event-to-state reducer described above |
| `initialState()` | usePanel.ts | Returns the idle `PanelState` |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- `agent_token`'s targeting logic (`t.agent === action.agent && t.streaming`) matches by role + streaming flag, NOT by round number. This is safe only because exactly one turn can be `streaming: true` at a time per the orchestrator's sequential (never parallel) agent execution — worth knowing if the orchestration model ever changes to run agents concurrently, this reducer would need a round-aware match instead.
