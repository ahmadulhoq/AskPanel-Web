# Module: app/api/user

**Responsibility:** Pro-only custom persona CRUD on the user doc.

## Route Handlers

| Route | File | Responsibility |
|---|---|---|
| `PUT /api/user/persona` | persona/route.ts | Pro-gated. Validates `label` (non-empty), `respondentSystem`/`criticSystem` (≥20 chars each). Trims and caps `label` to 40 chars, each system prompt to 2000 chars. Writes `customPersona: { label, respondentSystem, criticSystem }` onto the user doc. Returns the saved object so the client can update local state without a re-fetch. |
| `DELETE /api/user/persona` | persona/route.ts | Auth required (not Pro-gated — any signed-in user can clear the field, harmless no-op if it was never set). Sets `customPersona: null` on the user doc. |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- Note the saved `customPersona` here is the user's *template*; it is copied onto individual panel docs at creation time when `persona === 'custom'` (`POST /api/panels`) — editing/deleting the saved persona after a panel was created does not retroactively affect that panel's already-copied `customPersona`. This is intentional (see CONVENTIONS.md "self-contained panel docs").
- `DELETE` is intentionally not Pro-gated (unlike `PUT`) — a user who downgrades from Pro should still be able to clear a stale custom persona selection. Not a bug.
