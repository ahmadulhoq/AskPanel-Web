# Agent Changelog: askpanel-web

## 2026-09-14 — Full cartography pass

- Mapped all 19 modules / 61 source files (split-symbols mode) — `.memory/symbols/*.md`, `SYMBOLS.md` index, `MAP.md` architecture doc
- Populated `CONVENTIONS.md` from observed patterns + a Next.js 16 best-practice check (server-components-for-data / client-leaves confirmed as current best practice)
- Formalized 8 SACRED entries (S001-S008) from existing human-authored rules in `.claude/rules/repo-rules.md`, plus one new one (S008, from NR-001 triage) covering why server components still `redirect('/login')` despite `proxy.ts` existing
- Logged 4 TECH_DEBT entries: TD-001 (SSRF DNS-rebinding gap in context/extract), TD-002 (minor import style), TD-003 (FollowUpComposer hardcodes isPublic:true), TD-004 (unused shared Textarea primitive still carries the original jumping-textarea bug)
- Wrote LESSONS.md Lesson 001 — the shared `components/ui/textarea.tsx` still has the `field-sizing-content` bug that was the very first issue fixed in this project's history; it's just unused, not actually fixed
- Triaged NR-001 (auth-rule-vs-code contradiction) with the user — resolved as "rule wording was wrong" — separately committed a 1-line fix to `.claude/rules/repo-rules.md` on `main` (commit b839463)
- Populated `VERSIONS.md` with real installed versions and `DEPENDENCY_ALERTS.md` with 4 open alerts (DA-001 through DA-004) — most notably: this repo's docs say "Next.js 15" throughout but the actual running version is **16.2.6**, and `proxy.ts` is a Next.js 16 feature (Node.js runtime, not edge) — the stale "edge bundle size" comment in `proxy.ts` may need a follow-up look
- Flipped `CONFIG.md` Status: pilot → active

## 2026-05-24 — Initial agentic setup via setup-skeleton workflow

- Installed agentskel v1.57.0 on askpanel-web
- Created ai-memory orphan branch and .memory/ worktree
- Initialised memory files: CONFIG, RULES, MAP, SYMBOLS, RESUME, VERSIONS, CONVENTIONS, SACRED, TECH_DEBT, NEEDS_REVIEW, LESSONS, CHANGELOG, TIME_LOG, DEPENDENCY_ALERTS, DEPENDENCY_HISTORY, BACKLOG
- Created .agents/ structure: rules, workflows, skills, standards (web platform)
- Created .claude/ structure: rules, skills stubs, hooks, settings.json
- Created .agent symlink for Antigravity
- Added AGENTS.md, CLAUDE.md, GEMINI.md, .claudeignore
- Added .github/CODEOWNERS, scripts/install-agent.sh
- GitHub: ahmadulhoq/AskPanel-Web
