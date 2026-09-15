# Technical Debt Registry

## Anti-Patterns
| ID | Module | Description | Severity | Found |
|----|--------|-------------|----------|-------|

## Bugs
| ID | Module | Description | Severity | Found |
|----|--------|-------------|----------|-------|

## Missing Tests
| ID | Module | Description | Found |
|----|--------|-------------|-------|

## Structural Issues
| ID | Module | Description | Severity | Found |
|----|--------|-------------|----------|-------|
| TD-002 | app/api/auth (session/route.ts) | Two separate `import` statements from `@/lib/firebase/admin` (`adminDb`, then `adminAuth`) on consecutive lines instead of one combined import. Purely cosmetic. | low | 2026-09-14 (cartographer) |

## Dead Code
| ID | Module | Description | Found |
|----|--------|-------------|-------|

## Spec Drift
| ID | Description | Found |
|----|-------------|-------|

---

## Resolved

| ID | Module | Description | Resolved |
|----|--------|-------------|----------|
| TD-001 | app/api/context/extract/route.ts | SSRF DNS-rebinding gap — was checking literal hostname only. Fixed 2026-09-15: resolves hostname via `dns.lookup()` and validates every returned IP; also switched to manual redirect handling with per-hop re-validation (BL-024). | 2026-09-15 |
| TD-003 | components/panel/FollowUpComposer.tsx | Hardcoded `isPublic: true` on follow-up panels. Fixed 2026-09-15: threaded `panel.isPublic` through `PanelPage` → `PanelThread` → `FollowUpComposer` (BL-025). | 2026-09-15 |
| TD-004 | components/ui/textarea.tsx | Unused primitive carrying the original jumping-textarea bug. Fixed 2026-09-15: removed `field-sizing-content`; auto-grow remains the responsibility of composer components with JS-controlled resize (BL-026). | 2026-09-15 |
