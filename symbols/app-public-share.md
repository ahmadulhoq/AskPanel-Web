# Module: app/p/[panelId]

**Responsibility:** Public, unauthenticated share view of a completed panel.

## Pages

| Name | File | Responsibility |
|---|---|---|
| `PublicPanelPage` | page.tsx | Server component, NO auth check (by design — this is the public share surface). `notFound()` unless `panel.isPublic && panel.status === 'complete'`. Reconstructs `turns`/`syntheses` arrays from `panel.rounds` (same shape `usePanel`'s reducer would have produced from live SSE events) since there's no live stream here — it's a static render of a finished panel. `generateMetadata()` sets OpenGraph title/description from the question/answer, but only if `panel.isPublic` (returns `{}` otherwise, so a private panelId doesn't leak metadata even via social link previews). |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- This page independently re-implements the round/turn reconstruction + `issuesFound` same-round-synthesis lookup that `PanelThread`/`usePanel` do for the live view — necessarily so, since there's no SSE stream on a static public page. If this logic changes in one place it should be reviewed in the other (`components/panel/PanelThread.tsx`) — not currently extracted into a shared helper. Not flagged as TECH_DEBT (the duplication is small — one `.find()` per turn — and the two contexts genuinely differ: one is live-streaming state, the other is a one-shot server render), but worth knowing about for future changes to the issuesFound/round-grouping logic.
