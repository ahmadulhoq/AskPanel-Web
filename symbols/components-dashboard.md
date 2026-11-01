# Module: components/dashboard

**Responsibility:** Dashboard-specific composition — the panel history list (search/filter) and the composer wrapper that wires together persona/context/rounds state.

## Components

| Name | File | Responsibility |
|---|---|---|
| `PanelList` | PanelList.tsx | Client component. Takes `panels: PanelSummary[]` (plain, pre-serialized by the server — see `app-protected-pages` module). Client-side `useMemo` filter by text query (matches `title ?? question`) and status pill (all/complete/running/error). Filters only render once `panels.length > 3`. Also exports the `PanelSummary` type — the dashboard page imports it as a type-only import to build the array server-side. |
| `QuestionComposer` | QuestionComposer.tsx | The top-level composer wrapper. Owns `question`, `isPublic`, `persona`, `userContext`, `maxRounds`, `customPersona` state (the last seeded from `initialCustomPersona` prop). Composes `PersonaSelector` + conditional `StarterQuestions` (only shown while `question` is empty) + `ContextInput` + `PanelInput` + `RoundsSelector` — this is the single place all those pieces come together for a *new* panel (as opposed to `FollowUpComposer`, which is deliberately simpler). |
| `RoundsSelector` | RoundsSelector.tsx | 1/2/3 pill group. Round 3 shows a Lock icon and opens `PaywallDialog` for non-Pro tier — same lock-icon-opens-paywall convention as `PersonaSelector`. |
| `StarterQuestions` | StarterQuestions.tsx | 6 static example-question chips (Career/Strategy/Invest/Ethics/Technical/Decision) that call `onSelect(question)` to pre-fill the composer. Pure presentational, no state of its own. |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- `PanelSummary` (defined in `PanelList.tsx`, not `types/index.ts`) is a dashboard-view-specific projection of `PanelDoc`, not a general-purpose type — correctly kept local to the component that needs it rather than added to the shared `types/index.ts` (which is reserved for cross-cutting domain types per CONVENTIONS.md).

- 2026-11-01 (BL-040): `PanelList({ initialPanels, initialNext })` — first page from the server (so `router.refresh()` updates it), later pages kept in state via "Show more" (`GET /api/panels?cursor=`). `PanelSummary` moved to `types/index.ts`. `components/ConfirmDeleteButton.tsx` (trash icon + confirm dialog → DELETE endpoint → redirect) is used on the panel and conversation pages.

- 2026-11-01 (BL-044): the dashboard is `NewConversation` (chat composer + StarterQuestions via `ChatComposer initialText`/key remount) + `ConversationList({ initialConversations, initialNext })` (title, debate count, date; search when >5; Show more via `GET /api/conversations?cursor=`). Removed: QuestionComposer, PanelList, PanelInput. `/chat` redirects to `/dashboard`.
