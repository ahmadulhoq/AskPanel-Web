# Backlog — AskPanel

> Managed by AI Agent. Updated at task-completion. Line count checked at session start.
> P0 = do next session | P1 = this sprint | P2 = someday/nice-to-have
> ID format: BL-NNN (sequential, never reused). Done section capped at 5 entries.
> Jira Ticket: populate when a Jira ticket exists for this item. Leave blank if unplanned in Jira.

| ID | Priority | Title | Added | Jira Ticket | Notes |
|----|----------|-------|-------|-------------|-------|
| BL-004 | P0 | Add GCP HTTP referrer restrictions to Firebase API key | 2026-05-25 | | In GCP Console → Credentials → browser key, add `https://askpanel.app/*` as allowed referrer; dismiss GitHub secret scanning alert as false positive |
| BL-002 | P1 | Deploy to Firebase App Hosting | 2026-05-24 | | Connect GitHub repo in Firebase Console; live URL unlocks BL-003. Deploy `firestore.rules` + indexes too (`firebase deploy --only firestore`) — the rules now deny all client access |
| BL-031 | P1 | Post-deploy smoke test: Sonnet 5.5 + background runs | 2026-10-05 | | Never run against real Firebase Auth or the live Anthropic API. After BL-002: one panel per persona (tone, valid Synthesizer `tool_use`, title); start a debate and close the tab mid-run, reopen after a minute (should have progressed/finished); open the same panel in two tabs (one run only); /chat: quick reply, Debate, Debate this. All of this already passes against emulators + a fake model API — this is the real-services check |
| BL-003 | P1 | Set up Stripe webhook endpoint in production | 2026-05-24 | | After live URL known: add the endpoint `/api/stripe/webhook` in Stripe with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`; set `stripe-webhook-secret` in Secret Manager. Test with `stripe trigger` (renewal, failed payment, cancel at period end) |
| BL-035 | P1 | Decide the Pro run cap | 2026-10-30 | | Upgrade dialog promises "100 panel runs / month"; code gives Pro unlimited runs. Either enforce a cap or fix the copy (audit #5). Needs a pricing decision — see v2 spec §8, §13 |
| BL-037 | P1 | Decide `cpuAlwaysAllocated` | 2026-10-31 | | On (current): debates finish while users are away; CPU billed for instance lifetime. Off: cheaper; unwatched debates pause and resume on return. v2 spec §13.5 |
| BL-038 | P2 | Lint, CI, e2e harness, and paywall title | 2026-10-30 | | `npm run lint` fails (2 pre-existing errors). No CI — add lint + `npm test` + build on push. Commit the browser e2e harness (emulators + fake model API + Playwright, recipe in `.memory/RULES.md`) so it can run in CI. Paywall dialog always says "You've used your 5 free panel runs" even when opened from a locked Pro feature (audit #9) |
| BL-040 | P2 | Launch basics | 2026-10-30 | | Privacy policy + terms pages, account deletion, panel deletion, dashboard access beyond the latest 20 panels, rate limiting |
| BL-047 | P1 | Decide quick-reply limits and model | 2026-10-31 | | Free users get 30 quick replies/day — a placeholder (`lib/billing/replies.ts`). Also whether replies use Sonnet 5.5 (current) or a cheaper model. v2 spec §13.1–13.2 |
| BL-048 | P2 | v2 M1 follow-ups | 2026-10-31 | | Not in M1: persona and rounds choice for debates started in chat (uses General, 2 rounds); Stop button for a running debate (spec §3.3); rolling summary for long conversations (spec §5 — replies currently see the last ~24k chars); conversation sharing (spec §13.4 — chat debates are private) |
| BL-042 | P2 | v2 M2: coordinator auto-routing | 2026-10-31 | | `convene_panel` tool, free-tier consent card, override logging, metering changes (spec §4, §8) |
| BL-043 | P2 | v2 M3: compare-options debate mode | 2026-10-31 | | Spec §7.3 |
| BL-044 | P2 | v2 M4: migrate v1 panels, conversation-list dashboard, launch | 2026-10-31 | | Spec §10 |
| BL-045 | P2 | v2 M5: MCP server (plugin distribution) | 2026-10-31 | | Async `start_debate` / `get_debate_result` tools; OAuth; links back to transcripts (spec §11) |
| BL-029 | P3 | Deliberate upgrade: firebase-admin 13 → 14 (major) | 2026-09-14 | | Major upgrade — needs approval per repo rules. **Plan ready (2026-10-05):** trial-installed 14.5.0 locally — `tsc` and `next build` both pass, no code changes needed. Only open question: v14 requires **Node ≥22** — confirm the App Hosting runtime is Node 22+ before applying. See DEPENDENCY_ALERTS DA-004 |

---

## Done (last 5)

| ID | Title | Completed |
|----|-------|-----------|
| BL-046 | App rendered in the browser's default serif: fixed self-referential `--font-sans` (now Geist) | 2026-10-31 |
| BL-041 | v2 M1: conversations at /chat (beta) — quick replies, Debate button, "Debate this", inline live debates; verified in a browser | 2026-10-31 |
| BL-039 | Streaming UI: Streamdown (styled markdown — `prose` had been a no-op) + scroll that stops following when you scroll up | 2026-10-31 |
| BL-036 | Stripe: renewals, failed payments, scheduled cancellations synced (order-proof); /account shows them | 2026-10-31 |
| BL-034 | Persona picked after typing is now actually used | 2026-10-31 |
