# Agent Changelog: askpanel-web

## 2026-09-15 — BL-024–027: security fix + two bug fixes + doc corrections

- BL-024: closed the SSRF DNS-rebinding gap in `app/api/context/extract` — resolves hostname via `dns.promises.lookup()` and checks every returned IP; switched to manual redirect handling (`redirect: 'manual'`) so each hop is independently re-validated before being followed (fetch's automatic redirect-following previously bypassed the hostname check entirely)
- BL-025: `FollowUpComposer` now inherits the parent panel's `isPublic` (threaded `PanelPage` → `PanelThread` → `FollowUpComposer`) instead of hardcoding `true`
- BL-026: removed `field-sizing-content` from the shared `components/ui/textarea.tsx` — the property that caused this project's original jumping-textarea bug; it's still unused but no longer a landmine
- BL-027: corrected "Next.js 15" → "Next.js 16" and the false "Node 25" claim across `.claude/rules/repo-rules.md`, `.agents/rules/repo-rules.md` (also brought its auth-rule wording in sync with the S008/NR-001 fix, which had only reached the `.claude/` copy), `AGENTS.md`, `docs/engineering/plans/mvp-architecture.md`
- TECH_DEBT.md: TD-001, TD-003, TD-004 moved to Resolved; DEPENDENCY_ALERTS.md: DA-001, DA-002 moved to Resolved
- BACKLOG.md: BL-024–027 moved to Done

## 2026-09-14 — BL-023: usage/billing account page

- New `/account` page (server component): shows current tier, free-run count + reset date, or Pro renewal date
- `POST /api/stripe/portal`: creates a Stripe Billing Portal session for Pro users with a `stripeCustomerId`
- `BillingPortalButton` client component redirects to the returned portal URL
- Dashboard header gets an "Account" link
- Committed to `main` directly (ee14b0e) per confirmed direct-to-main flow
- BACKLOG.md: moved BL-021, BL-022, BL-023 to Done (were shipped earlier this session but not previously marked); added BL-024–BL-027 from cartography TECH_DEBT/DEPENDENCY_ALERTS findings

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
