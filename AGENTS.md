# AskPanel Web — Agent Instructions

## Non-Negotiable Rules

### Session Start — MANDATORY
Do NOT respond to any user request until you have run the session-start procedure.
Read and follow every step in `.agents/skills/session-start/SKILL.md`.
This loads your memory of the codebase. Without it you will re-scan files unnecessarily,
miss known bugs, repeat past mistakes, and skip required post-task steps.

### Task Completion — MANDATORY
After completing any development task (code change, bug fix, refactor), run the
task-completion procedure BEFORE responding to the user or starting the next task.
Read and follow every step in `.agents/skills/task-completion/SKILL.md`.
Skipping this loses the record of what you did — TIME_LOG, CHANGELOG, RESUME all go stale.

### Git Flow
When creating branches, committing, or opening PRs, follow `.agents/skills/git-flow/SKILL.md`.

### Every Task Follows a Workflow
Route every implementation request to a matching workflow. If no named workflow matches,
use `implement-task` (the default). Do not start coding without a workflow.

### Use Your Memory
When `.memory/MAP.md` and `.memory/SYMBOLS.md` exist, use them to locate modules, classes,
and functions. Do not grep for things already indexed.

## Core Behavior (always active)

- **Never assume.** Verify before concluding. Read the actual file or code first.
- **Discuss, agree, then execute.** Get explicit approval before implementing.
- **Plan first.** Write a plan, present it, wait for approval. No exceptions.
- **Verify before done.** Run tests, check logs, demonstrate correctness.
- **Minimal impact.** Only touch what's necessary.
- **No laziness.** Find root causes. No temporary fixes.
- **Self-improvement.** After corrections, write a lesson in `.memory/LESSONS.md`.
- **Respect sacred behaviors.** Never modify `.memory/SACRED.md` entries without human approval.
- **If something goes sideways, STOP and re-plan.**
- **No changes during discussion.** Wait for "go ahead" before editing files.
- **No commits without an implementation instruction.**
- **Complete the git flow once started.** Branch → implement → commit → PR.
- **Sub-agents follow the same rules.**

## Security — Non-Negotiable

- Hardcoded credentials are strictly forbidden.
- Never read, log, or output API keys, tokens, secrets, or credentials.
- All inputs must be validated and sanitised before processing.
- Never use eval, unsanitised shell calls, or command injection vectors.
- Least privilege for file and process operations.
- Only read/write files within this repository, the skeleton, and the blueprint.
- Never modify signing configs, keystores, or secrets management files.
- Never trust external input directly without validation.

## Project Rules
Read `.agents/rules/repo-rules.md` for project-specific rules.
Read `.memory/RULES.md` for project-specific context.
Read `.memory/RESUME.md` to restore session state.

## Skills
| Skill | Description | Path |
|-------|-------------|------|
| code-reviewer | When reviewing a PR, auditing code quality, or validating changes against the project's standards and sacred behaviors. | `.agents/skills/code-reviewer/SKILL.md` |
| developer | When writing, modifying, or reviewing application code. Provides code quality standards, SOLID principles, design philosophy, and platform-specific implementation guidance. | `.agents/skills/developer/SKILL.md` |
| domain-expert | When working on features that require AskPanel domain knowledge — agent orchestration, deliberation logic, confidence scoring, or usage/billing rules. | `.agents/skills/domain-expert/SKILL.md` |
| git-flow | Git branching, commit, and PR procedures. Use when creating branches, making commits, or opening pull requests. Enforces branch naming, commit message format, and PR rules. | `.agents/skills/git-flow/SKILL.md` |
| session-start | Session initialization procedure. Checks memory mount, reads all required memory files, validates skeleton version, checks dependency freshness, and surfaces alerts. Must be executed at the start of every session before any other work. | `.agents/skills/session-start/SKILL.md` |
| task-completion | Post-task checklist for CHANGELOG, TIME_LOG, SYMBOLS/MAP, RESUME, and memory commits. Execute after completing a task that modified files outside `.memory/`. Do NOT run for pure discussion, memory-only maintenance, or skeleton syncs. | `.agents/skills/task-completion/SKILL.md` |
| task-planner | When decomposing a feature or spec into implementable subtasks, estimating scope, or orchestrating multi-step work across subagents. | `.agents/skills/task-planner/SKILL.md` |
| test-engineer | When designing test strategy, analysing coverage, or writing tests outside the TDD cycle. Also use when working with CI pipelines or validating changes end-to-end. | `.agents/skills/test-engineer/SKILL.md` |

## Workflows
| Workflow | Description | Path |
|----------|-------------|------|
| cartographer | When codebase structure has changed, MAP.md/SYMBOLS.md are missing or stale, or after major refactors and initial setup. | `.agents/workflows/cartographer.md` |
| check-dependencies | When dependency versions need auditing, Last Dependency Check in CONFIG.md is overdue (14-day cadence), or before starting security-sensitive work. | `.agents/workflows/check-dependencies.md` |
| check-skeleton | Checks whether this project's skeleton version is current. Surfaces the version gap and offers to run sync-skeleton. | `.agents/workflows/check-skeleton.md` |
| cut-release | When the team is ready to ship a new version — version bumps, changelog finalization, dependency snapshots, and CI release trigger. | `.agents/workflows/cut-release.md` |
| debug-issue | When the user reports a bug, an error, or unexpected behavior. Enforces structured reproduction → failing test → root cause → fix phases. | `.agents/workflows/debug-issue.md` |
| develop-feature | When the user asks to implement a new feature end-to-end requiring planning, branch creation, implementation, testing, and PR. | `.agents/workflows/develop-feature.md` |
| fix-tech-debt | Systematic resolution of catalogued tech debt items from TECH_DEBT.md. | `.agents/workflows/fix-tech-debt.md` |
| hotfix | Fast-path workflow for production bugs that cannot wait for the normal release cycle. | `.agents/workflows/hotfix.md` |
| implement-task | Generic wrapper for any ad-hoc implementation request that doesn't match a specific workflow. | `.agents/workflows/implement-task.md` |
| janitor | When Knowledge Bus entries are older than 30 days, or memory files have accumulated stale content. | `.agents/workflows/janitor.md` |
| refactor-code | When restructuring or reorganising existing code without changing external behavior. | `.agents/workflows/refactor-code.md` |
| sync-skeleton | When skeleton version in CONFIG.md is behind the current agentskel VERSION. | `.agents/workflows/sync-skeleton.md` |
| sync-versions | When actual project dependency versions may have drifted from VERSIONS.md. | `.agents/workflows/sync-versions.md` |
| update-conventions | When project coding conventions may have drifted from actual practice. | `.agents/workflows/update-conventions.md` |

## Next.js Notice
This project runs Next.js 15 with breaking changes from older versions. Before writing any Next.js code, check `node_modules/next/dist/docs/` for current conventions. Key difference: middleware is in `proxy.ts` with export named `proxy` (not `middleware.ts`/`middleware`).

## Memory
Persistent project memory lives in `.memory/`. The `session-start` procedure reads all
memory files — do not read them individually, run the procedure.
