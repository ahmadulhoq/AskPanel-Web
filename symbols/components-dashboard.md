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
