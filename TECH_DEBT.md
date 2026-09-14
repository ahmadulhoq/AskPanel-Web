# Technical Debt Registry

## Anti-Patterns
| ID | Module | Description | Severity | Found |
|----|--------|-------------|----------|-------|

## Bugs
| ID | Module | Description | Severity | Found |
|----|--------|-------------|----------|-------|
| TD-003 | components/panel/FollowUpComposer.tsx | Follow-up panels are always created with `isPublic: true` hardcoded in the POST body — does not inherit the parent panel's actual `isPublic` value, and there's no toggle for the user to choose (unlike the main `PanelInput`, which has a Public/Private toggle). A user who marks their original panel private, then asks a follow-up, gets a follow-up panel that is public by default with no visible warning. No comment explains this as intentional. Fix: default to `parentPanel.isPublic` (would need the panel page to pass it down) or add the same toggle `PanelInput` has. | medium | 2026-09-14 (cartographer) |
| TD-001 | app/api/context (extract/route.ts) | `isPrivateHost()` SSRF guard checks only the literal hostname string, not the resolved IP — a DNS-rebinding attack (attacker-controlled domain resolving to a private/loopback IP) would bypass it since the check never resolves DNS before `fetch()` connects. Fix: resolve the hostname first and check the resolved IP(s), or use a fetch wrapper/agent that validates the connected socket address. Requires attacker to control DNS for a domain a Pro user pastes; blast radius limited to text-extraction of the fetched response (no credential/token exposure). | medium | 2026-09-14 (cartographer) |

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
| TD-004 | components/ui/textarea.tsx | Unused (zero imports anywhere in the app) AND still carries the `field-sizing-content` CSS property that caused this project's original "jumping textarea" bug (see LESSONS.md Lesson 001). Every real composer (`PanelInput`, `FollowUpComposer`) bypasses it with a hand-rolled `<textarea>` + JS resize. Fix: apply the same JS-controlled resize pattern to this shared primitive so it's actually safe to use, or remove it if the project has standardized on hand-rolled composers. | 2026-09-14 (cartographer) |

## Spec Drift
| ID | Description | Found |
|----|-------------|-------|
