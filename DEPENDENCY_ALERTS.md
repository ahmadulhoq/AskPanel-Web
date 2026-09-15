# Dependency Alerts — AskPanel Web

> Populated by the `check-dependencies` workflow.
> Read at session start — surface any OPEN entries to the user before beginning work.
> Mark as RESOLVED once the upgrade is planned or completed (tech debt entry created).

---

## Active Alerts

| ID | Component | Issue | Severity | Found |
|----|-----------|-------|----------|-------|
| DA-003 | @anthropic-ai/sdk | Installed ^0.98.0, latest known 0.125.0 — pre-1.0 package, ~27 minor versions behind. Core dependency for the entire orchestration loop; upgrade should be deliberate with release notes reviewed, never automatic. | medium | 2026-09-14 |
| DA-004 | firebase-admin | Installed ^13.10.0, latest known 14.4.0 — one major version behind. | low | 2026-09-14 |

See `.memory/VERSIONS.md` for full detail and sourcing on each entry.

---

## Resolved Alerts

| ID | Component | Issue | Resolution | Resolved |
|----|-----------|-------|------------|----------|
| DA-001 | Docs (AGENTS.md, .claude/rules/repo-rules.md, .agents/rules/repo-rules.md, docs/engineering/plans/mvp-architecture.md) | All said "Next.js 15" but installed/running version is 16.2.6. | Corrected to "Next.js 16" in all four files; also noted `proxy.ts` runs on the Node.js runtime, not edge (BL-027). | 2026-09-15 |
| DA-002 | .claude/rules/repo-rules.md, .agents/rules/repo-rules.md | Said "Node 25" but no version is actually pinned anywhere; container observed v22.22.2. | Replaced the false specific version claim with an accurate statement — no `.nvmrc`/`engines.node` pin exists; `.bin/` wrapper issue is unrelated to a specific Node version (BL-027). | 2026-09-15 |
