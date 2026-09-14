# Dependency Alerts — AskPanel Web

> Populated by the `check-dependencies` workflow.
> Read at session start — surface any OPEN entries to the user before beginning work.
> Mark as RESOLVED once the upgrade is planned or completed (tech debt entry created).

---

## Active Alerts

| ID | Component | Issue | Severity | Found |
|----|-----------|-------|----------|-------|
| DA-001 | Docs (AGENTS.md, .claude/rules/repo-rules.md, .claude/rules/bootstrap.md) | All say "Next.js 15" but the installed/running version is **16.2.6**. `proxy.ts` is actually a Next.js 16 feature (runs on Node.js runtime, not edge) per Next.js's own migration guide. | medium | 2026-09-14 |
| DA-002 | .claude/rules/repo-rules.md | Says "Node 25: `.bin/` wrappers broken" but this container's actual `node --version` is v22.22.2 — no `.nvmrc`/`engines.node` pin exists anywhere to confirm the intended deployed version. | low | 2026-09-14 |
| DA-003 | @anthropic-ai/sdk | Installed ^0.98.0, latest known 0.125.0 — pre-1.0 package, ~27 minor versions behind. Core dependency for the entire orchestration loop; upgrade should be deliberate with release notes reviewed, never automatic. | medium | 2026-09-14 |
| DA-004 | firebase-admin | Installed ^13.10.0, latest known 14.4.0 — one major version behind. | low | 2026-09-14 |

See `.memory/VERSIONS.md` for full detail and sourcing on each entry.

---

## Resolved Alerts

*(none)*
