# Technical Debt Registry

## Anti-Patterns
| ID | Module | Description | Severity | Found |
|----|--------|-------------|----------|-------|

## Bugs
| ID | Module | Description | Severity | Found |
|----|--------|-------------|----------|-------|
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

## Spec Drift
| ID | Description | Found |
|----|-------------|-------|
