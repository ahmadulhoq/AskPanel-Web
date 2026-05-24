# Dependency & Toolchain Management — AskPanel Web

> Applies to: askpanel-web
> During setup, trim platform-specific sections to match the project's stack.

## Principles

- **One thing at a time.** Never upgrade multiple interdependent tools in a single PR.
- **CI is the gate.** No upgrade merges unless CI passes completely.
- **Agents propose, humans approve.** Never merge dependency PRs.
- **Track before upgrading.** See `.memory/VERSIONS.md`.

---

## Upgrade Tiers

### Tier 1 — Patch (any dev, merge anytime after CI)
Library bugfix releases. No new APIs, no behaviour changes.

### Tier 2 — Minor (tech lead review, scheduled)
Minor version bumps. New APIs available but no breaking changes.

### Tier 3 — Major / Breaking (lead engineer required)
Major version bumps, breaking API changes, or runtime target bumps.

**Approval required: @ahmadulhoq sign-off before merge.**

### Tier 4 — Business Impact (lead engineer + PM required)
Changes affecting supported runtimes or platform policy.

---

## Web / Node.js CODEOWNERS

```
# Toolchain and dependencies — lead engineer only (solo project)
/package.json                                @ahmadulhoq
/package-lock.json                           @ahmadulhoq

# CODEOWNERS itself
/.github/CODEOWNERS                          @ahmadulhoq
```

---

## Dependency Staleness Policy

| Condition | Priority | Action |
|---|---|---|
| Security fix available, any age | Critical | `DU-` tech debt (critical) + DEPENDENCY_ALERTS entry |
| Major version available, > 6 months | High | `DU-` tech debt (high) |
| Minor version available, > 3 months | Medium | `DU-` tech debt (medium) |
| Patch version available, > 2 months | Low | `DU-` tech debt (low) |

Run `check-dependencies` every 14 days.

---

## Agent Rules

- Read release notes before proposing any upgrade. Record URL in `VERSIONS.md`.
- Stable only — never target alpha, beta, RC, canary, or snapshot versions.
- Prepare upgrade PRs on a dedicated branch (`dep-update-[package]-[version]`).
- Never merge — always wait for human approval.
