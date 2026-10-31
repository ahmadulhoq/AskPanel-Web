# Backlog — AskPanel

> Managed by AI Agent. Updated at task-completion. Line count checked at session start.
> P0 = do next session | P1 = this sprint | P2 = someday/nice-to-have
> ID format: BL-NNN (sequential, never reused). Done section capped at 5 entries.
> Jira Ticket: populate when a Jira ticket exists for this item. Leave blank if unplanned in Jira.

| ID | Priority | Title | Added | Jira Ticket | Notes |
|----|----------|-------|-------|-------------|-------|
| BL-004 | P0 | Add GCP HTTP referrer restrictions to Firebase API key | 2026-05-25 | | In GCP Console → Credentials → browser key, add `https://askpanel.app/*` as allowed referrer; dismiss GitHub secret scanning alert as false positive |
| BL-002 | P1 | Deploy to Firebase App Hosting | 2026-05-24 | | Connect GitHub repo in Firebase Console; live URL unlocks BL-003. Deploy `firestore.rules` + indexes too (`firebase deploy --only firestore`) — the rules now deny all client access |
| BL-031 | P1 | Post-deploy smoke test: Sonnet 5.5 + background runs | 2026-10-05 | | Never run against real Firebase Auth or the live Anthropic API. After BL-002: one panel per persona (tone, valid Synthesizer `tool_use`, title); start a debate and close the tab mid-run, reopen after a minute (should have progressed/finished); open the same panel in two tabs (one run only) |
| BL-003 | P1 | Set up Stripe webhook endpoint in production | 2026-05-24 | | After live URL known; add webhook in Stripe dashboard, set `stripe-webhook-secret` in Secret Manager |
| BL-034 | P1 | Persona picked after typing the question is ignored | 2026-10-30 | | `PanelInput` `submit` useCallback omits `persona` (and `parentPanelId`) from its deps, so the stale persona is sent. Flagged by lint (audit #6) |
| BL-035 | P1 | Decide the Pro run cap | 2026-10-30 | | Upgrade dialog promises "100 panel runs / month"; code gives Pro unlimited runs. Either enforce a cap or fix the copy (audit #5). Needs a pricing decision — see v2 spec §8, §13 |
| BL-036 | P1 | Stripe webhook: handle renewals and failed payments | 2026-10-30 | | Only `checkout.session.completed` and `customer.subscription.deleted` are handled: renewal date on /account goes stale after the first period; past-due users stay Pro. Add `customer.subscription.updated` (+ `invoice.payment_failed`) (audit #7) |
| BL-037 | P1 | Decide `cpuAlwaysAllocated` | 2026-10-31 | | On (current): debates finish while users are away; CPU billed for instance lifetime. Off: cheaper; unwatched debates pause and resume on return. v2 spec §13.5 |
| BL-038 | P2 | Lint, CI, and paywall title | 2026-10-30 | | `npm run lint` fails (2 errors). No CI — add lint + `npm test` + build on push. Paywall dialog always says "You've used your 5 free panel runs" even when opened from a locked Pro feature (audit #9) |
| BL-039 | P2 | Streaming UI: Streamdown + use-stick-to-bottom | 2026-10-30 | | Half-rendered markdown while streaming; thread auto-scroll yanks the reader down on every update. Swap `react-markdown` for Streamdown in AgentTurn/FinalAnswer, use `use-stick-to-bottom` in PanelThread. Carries into v2 (spec §9) |
| BL-040 | P2 | Launch basics | 2026-10-30 | | Privacy policy + terms pages, account deletion, panel deletion, dashboard access beyond the latest 20 panels, rate limiting |
| BL-041 | P1 | v2 M1: conversations + quick replies + "Debate this" | 2026-10-31 | | `docs/engineering/plans/v2-conversational-spec.md` §12. Conversation data model, quick-reply streaming, chat UI, manual debate button |
| BL-042 | P2 | v2 M2: coordinator auto-routing | 2026-10-31 | | `convene_panel` tool, free-tier consent card, override logging, metering changes (spec §4, §8) |
| BL-043 | P2 | v2 M3: compare-options debate mode | 2026-10-31 | | Spec §7.3 |
| BL-044 | P2 | v2 M4: migrate v1 panels, conversation-list dashboard, launch | 2026-10-31 | | Spec §10 |
| BL-045 | P2 | v2 M5: MCP server (plugin distribution) | 2026-10-31 | | Async `start_debate` / `get_debate_result` tools; OAuth; links back to transcripts (spec §11) |
| BL-029 | P3 | Deliberate upgrade: firebase-admin 13 → 14 (major) | 2026-09-14 | | Major upgrade — needs approval per repo rules. **Plan ready (2026-10-05):** trial-installed 14.5.0 locally — `tsc` and `next build` both pass, no code changes needed. Only open question: v14 requires **Node ≥22** — confirm the App Hosting runtime is Node 22+ before applying. See DEPENDENCY_ALERTS DA-004 |

---

## Done (last 5)

| ID | Title | Completed |
|----|-------|-----------|
| BL-033 | Debates run as background jobs: survive leaving the page, one run per panel, resume after crashes, runs reserved at creation (closes free-limit bypass), tests | 2026-10-31 |
| BL-032 | Security lockdown: Firestore rules deny client access, server clamps model/rounds, Next.js 16.4.3 (0 critical advisories) | 2026-10-30 |
| BL-030 | Migrated DEFAULT_MODEL claude-sonnet-4-5 → claude-sonnet-5-5 (ahead of 2026-11-30 EOL); retry resets stored model | 2026-10-05 |
| BL-028 | Upgraded @anthropic-ai/sdk 0.98 → 0.131 (no breaking changes affecting our usage) | 2026-10-05 |
| BL-027 | Corrected "Next.js 15"/"Node 25" doc references (actual: Next.js 16.2.6) | 2026-09-15 |
