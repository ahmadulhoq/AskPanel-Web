# Module: app/(app)

**Responsibility:** Auth-protected pages — dashboard (question composer + panel history) and the individual panel view.

## Pages

| Name | File | Responsibility |
|---|---|---|
| `AppLayout` | layout.tsx | Server component. Calls `getSessionUser()`; `redirect('/login')` if null (see SACRED S008). Otherwise renders children unmodified. |
| `DashboardPage` | dashboard/page.tsx | Server component. Reads user doc (tier, freeRunsUsed, freeRunsResetAt, customPersona) and up to 20 panels (`orderBy('createdAt', 'desc')`). Serializes Firestore data into a plain `PanelSummary[]` (see `components-dashboard` module) before passing to client components — no raw Timestamps cross the RSC boundary. Renders header (run count or Pro badge + `SignOutButton`), upgrade success banner (`?upgraded=1`), `QuestionComposer`, `PanelList`. |
| `PanelPage` | panel/[panelId]/page.tsx | Server component. Auth + ownership check (`redirect('/login')` / `redirect('/dashboard')`). `generateMetadata()` sets page title from `panel.title ?? panel.question`. Renders sticky header (back link + conditional `ShareButton` if public), `QuestionBubble`, `PanelThread` (passed `panel.persona ?? 'general'`). |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- `formatResetDate()` in dashboard/page.tsx is the one place a Firestore `Timestamp` is converted to a display string server-side, before the client boundary — correct application of the CONVENTIONS.md serialization-boundary rule.
- See SACRED S008 for why the `redirect('/login')` calls here are intentional, not a rule violation.
