# Backlog — AskPanel

> Managed by AI Agent. Updated at task-completion. Line count checked at session start.
> P0 = do next session | P1 = this sprint | P2 = someday/nice-to-have
> ID format: BL-NNN (sequential, never reused). Done section capped at 5 entries.
> Jira Ticket: populate when a Jira ticket exists for this item. Leave blank if unplanned in Jira.

| ID | Priority | Title | Added | Jira Ticket | Notes |
|----|----------|-------|-------|-------------|-------|
| BL-004 | P0 | Add GCP HTTP referrer restrictions to Firebase API key | 2026-05-25 | | In GCP Console → Credentials → browser key, add `https://askpanel.app/*` as allowed referrer; dismiss GitHub secret scanning alert as false positive |
| BL-002 | P1 | Deploy to Firebase App Hosting | 2026-05-24 | | Connect GitHub repo in Firebase Console; live URL unlocks BL-003. Deploy `firestore.rules` + indexes too (`firebase deploy --only firestore`) — the rules now deny all client access. Also add a Firestore TTL policy on collection `rateLimits`, field `expiresAt` (Console → Firestore → TTL), so rate-limit counters delete themselves |
| BL-031 | P1 | Post-deploy smoke test: Sonnet 5.5 + background runs | 2026-10-05 | | Never run against real Firebase Auth or the live Anthropic API. After BL-002: one panel per persona (tone, valid Synthesizer `tool_use`, title); start a debate and close the tab mid-run, reopen after a minute (should have progressed/finished); open the same panel in two tabs (one run only); /chat: quick reply, Debate, Debate this. All of this already passes against emulators + a fake model API — this is the real-services check |
| BL-003 | P1 | Set up Stripe webhook endpoint in production | 2026-05-24 | | After live URL known: add the endpoint `/api/stripe/webhook` in Stripe with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`; set `stripe-webhook-secret` in Secret Manager. Test with `stripe trigger` (renewal, failed payment, cancel at period end) |
| BL-050 | P1 | Legal details for /privacy and /terms | 2026-11-01 | | Still needed in `lib/legal.ts`: operator's legal name, a dedicated contact address, governing law (the pages say "Draft" until then). Policy calls decided 2026-11-01: keep no refunds except where the law requires, 16+, notice before price changes. Have the pages reviewed before launch |
| BL-051 | P3 | Compare mode follow-ups | 2026-11-01 | | Spec §7.3 items not in the first version: a Pro second round where proposers revise after the critique; let users type their own options (today proposers take options named in the question, else invent them) |
| BL-052 | P3 | MCP: OAuth sign-in for AI tools | 2026-11-01 | | Today MCP clients use a personal API token from /account (docs/mcp.md). OAuth (Client ID Metadata Documents per the 2026-07-28 spec) would let users connect Claude/Cursor without copying a token, and enables directory listings |
| BL-029 | P3 | Deliberate upgrade: firebase-admin 13 → 14 (major) | 2026-09-14 | | Major upgrade — needs approval per repo rules. **Plan ready (2026-10-05):** trial-installed 14.5.0 locally — `tsc` and `next build` both pass, no code changes needed. Only open question: v14 requires **Node ≥22** — confirm the App Hosting runtime is Node 22+ before applying. See DEPENDENCY_ALERTS DA-004 |

---

## Done (last 5)

| ID | Title | Completed |
|----|-------|-----------|
| BL-049 | Share single debates: a Share button on chat debates and the panel page (confirm, copy link, Stop sharing); conversations stay private; privacy + terms updated | 2026-11-01 |
| BL-035 | Pro capped at 100 debates per 30 days, counted and refunded like free runs; dashboard/account show what's left; a Pro user at the cap gets the reset date, not the paywall | 2026-11-01 |
| BL-053 | Fixed for Claude Sonnet 5.5: the Synthesizer and compare Judge used a forced tool_choice (a 400 on Sonnet 5.5 — every real debate would have failed at the verdict) and token caps too small for default thinking; the fake model API now enforces these rules | 2026-11-01 |
| BL-047 | Decided: replies + coordinator stay on Sonnet 5.5 (medium effort); titles and summaries on Haiku 5.5; free tier keeps 30 replies/day | 2026-11-01 |
| BL-037 | Decided: keep `cpuAlwaysAllocated` on (debates finish while users are away; MCP relies on it) | 2026-11-01 |
