# Dependency Alerts — AskPanel Web

> Populated by the `check-dependencies` workflow.
> Read at session start — surface any OPEN entries to the user before beginning work.
> Mark as RESOLVED once the upgrade is planned or completed (tech debt entry created).

---

## Active Alerts

| ID | Component | Issue | Severity | Found |
|----|-----------|-------|----------|-------|

See `.memory/VERSIONS.md` for full detail and sourcing on each entry.

---

## Resolved Alerts

| ID | Component | Issue | Resolution | Resolved |
|----|-----------|-------|------------|----------|
| DA-004 | firebase-admin | Was ^13.10.0, one major behind. | Upgraded to ^14.5.0 with user approval (BL-029, PR #12) after reading the v14 and @google-cloud/firestore 8/9 release notes — only Node-version and removed-feature breaks, none used. `engines.node >=22`; App Hosting runtime must be nodejs22+. | 2026-11-01 |
| DA-006 | next | 16.2.6 was in range of critical RCE advisories (image optimization, next/og, `use cache`). | Upgraded to 16.4.3; `npm audit` critical count 3 → 0. Remaining 4 highs are gRPC server-side advisories in the browser Firebase SDK's Firestore path — not reachable; no upstream fix (npm proposes a downgrade). | 2026-10-30 |
| DA-005 | Model `claude-sonnet-4-5` | Deprecated, EOL 2026-11-30; was DEFAULT_MODEL for every agent call. | Migrated to `claude-sonnet-5-5`; retry route resets pinned `config.model`. Live smoke test pending (BL-031). | 2026-10-05 |
| DA-003 | @anthropic-ai/sdk | Was ^0.98.0, ~30 minors behind. | Upgraded to ^0.131.0 after changelog review — no breaking changes to the APIs used (messages.create streaming, tools/tool_choice, cache_control). tsc + build pass (BL-028). | 2026-10-05 |
| DA-001 | Docs (AGENTS.md, .claude/rules/repo-rules.md, .agents/rules/repo-rules.md, docs/engineering/plans/mvp-architecture.md) | All said "Next.js 15" but installed/running version is 16.2.6. | Corrected to "Next.js 16" in all four files; also noted `proxy.ts` runs on the Node.js runtime, not edge (BL-027). | 2026-09-15 |
| DA-002 | .claude/rules/repo-rules.md, .agents/rules/repo-rules.md | Said "Node 25" but no version is actually pinned anywhere; container observed v22.22.2. | Replaced the false specific version claim with an accurate statement — no `.nvmrc`/`engines.node` pin exists; `.bin/` wrapper issue is unrelated to a specific Node version (BL-027). | 2026-09-15 |
