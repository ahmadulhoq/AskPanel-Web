# Dependency & Toolchain Versions — AskPanel Web
> Managed by: AI Agent
> Last Checked: 2026-09-14T00:00Z
> Policy: see `DEPENDENCY_MANAGEMENT.md` in the project's standards

## Toolchain

| Dependency | Current | Latest Known | Last Updated | Release Notes | Source | Notes |
|---|---|---|---|---|---|---|
| Node.js | v22.22.2 (runtime) | — | 2026-09-14T00:00Z | https://nodejs.org/en/blog/release | `node --version` (no `.nvmrc`/`engines` field found in package.json) | Not pinned anywhere in the repo — see Flags |
| Next.js | 16.2.6 | 16.2.6 (current major, not independently re-verified beyond confirming proxy.ts is a v16 feature) | 2026-09-14T00:00Z | https://nextjs.org/blog/next-16 | package.json | **Every rule doc in this repo (AGENTS.md, .claude/rules/repo-rules.md, .claude/rules/bootstrap.md) says "Next.js 15" — this is factually wrong. `proxy.ts` (replacing `middleware.ts`) is a Next.js 16 feature that runs on the Node.js runtime, not edge. See Flags.** |
| TypeScript | ^5.9.3 | — | 2026-09-14T00:00Z | https://devblogs.microsoft.com/typescript/ | package.json | Not independently checked against latest this pass |

---

## Key Dependencies

| Dependency | Current | Latest Known | Last Updated | Release Notes | Source | Notes |
|---|---|---|---|---|---|---|
| @anthropic-ai/sdk | ^0.98.0 | 0.125.0 | 2026-09-14T00:00Z | https://github.com/anthropics/anthropic-sdk-typescript/releases | package.json | Pre-1.0 semver — minor version bumps can carry breaking changes. ~27 minor versions behind. See Flags. |
| firebase | ^12.13.0 | — | 2026-09-14T00:00Z | https://firebase.google.com/support/releases | package.json | Not independently checked against latest this pass |
| firebase-admin | ^13.10.0 | 14.4.0 | 2026-09-14T00:00Z | https://firebase.google.com/support/release-notes/admin/node | package.json | One major version behind. See Flags. |
| stripe | ^22.1.1 | ~22.6.1 | 2026-09-14T00:00Z | https://github.com/stripe/stripe-node/releases | package.json | Same major, a few minors behind. Separately: `lib/stripe.ts` pins `apiVersion: '2026-04-22.dahlia'` — newer SDK releases reference a later pinned API version (`2026-08-26.dahlia` per latest changelog). Pinning an older API version is not itself a bug (Stripe supports old API versions for a long window) but worth knowing when next touching `lib/stripe.ts`. |
| pdf-parse | ^2.4.5 | — | 2026-09-14T00:00Z | https://www.npmjs.com/package/pdf-parse | package.json | Added 2026-09 for BL-021. Modern class-based API (`PDFParse`), not the older function-style `pdf-parse@1.x` — see CONVENTIONS.md. |

---

## Upgrade Log

| Date | Component | From | To | Tier | PR |
|------|-----------|------|----|------|----|

---

## Flags

| Component | Issue | Severity | Action Needed |
|-----------|-------|----------|--------------|
| Docs (AGENTS.md, .claude/rules/repo-rules.md, .claude/rules/bootstrap.md) | All three say "Next.js 15" but the installed/running version is 16.2.6. `proxy.ts` (documented as the Next.js 15 middleware rename) is actually a **Next.js 16** feature per Next.js's own release notes and migration guide. The docs may have been written against an earlier version of this project, or copied from a skeleton template that assumed 15. | medium | Update "Next.js 15" → "Next.js 16" in all three files. Not done automatically this pass — touches multiple governance files outside `.memory/`, flagging for explicit user decision rather than unilaterally editing (see cartography summary). |
| proxy.ts comment (`app: proxy.ts`) | The inline comment says the lightweight cookie-presence-only check exists "to keep the edge bundle small" (avoiding a firebase-admin import). Per Next.js 16 release notes, `proxy.ts` now always runs on the **Node.js runtime**, not edge — the edge-runtime constraint that motivated this design may no longer exist. The lightweight check may still be the right call for other reasons (avoiding redundant full verification on every request when server components already do it), but the *stated* rationale in the comment is likely stale/inaccurate for a Next.js 16 codebase. | low-medium | Review whether `proxy.ts` should now do full verification given the edge constraint is gone, or update the comment to give the real current rationale (e.g. "avoid double verification cost", not "edge bundle size"). Linked to SACRED S008 — do not change behavior without re-confirming with the user first, since S008 was already triaged once this session. |
| @anthropic-ai/sdk | ^0.98.0 installed vs. 0.125.0 latest — pre-1.0 package, ~27 minor versions behind. Given this SDK is the core dependency for the product's entire orchestration loop (`lib/agents/orchestrator.ts`), an eventual upgrade should be done deliberately with release notes reviewed (per Dependency Boundaries rule — never upgrade without explicit human instruction and a read of release notes). | medium | Do not auto-upgrade. Flag for the user to schedule a deliberate upgrade + regression test of the full panel run flow. |
| firebase-admin | ^13.10.0 installed vs. 14.4.0 latest — one major version behind. | low | Same as above — deliberate, planned upgrade only. |
| Node.js version pin | No `.nvmrc` and no `engines.node` field in package.json — the only record of the intended Node version is this VERSIONS.md entry (captured from the container's `node --version` at cartography time) and the informal `.claude/rules/repo-rules.md` mention of "Node 25" (`.bin/` wrappers broken note) — which itself doesn't match the actually-running v22.22.2 in this container. | low | Consider adding an explicit `engines.node` field or `.nvmrc` so the intended version is unambiguous and enforceable, and reconcile the "Node 25" rule-doc mention against whatever version is actually deployed. |
