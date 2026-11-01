# Backlog — AskPanel

> Managed by AI Agent. Updated at task-completion. Line count checked at session start.
> P0 = do next session | P1 = this sprint | P2 = someday/nice-to-have
> ID format: BL-NNN (sequential, never reused). Done section capped at 5 entries.
> Jira Ticket: populate when a Jira ticket exists for this item. Leave blank if unplanned in Jira.

| ID | Priority | Title | Added | Jira Ticket | Notes |
|----|----------|-------|-------|-------------|-------|
| BL-004 | P0 | Add GCP HTTP referrer restrictions to Firebase API key | 2026-05-25 | | In GCP Console → Credentials → browser key, add `https://askpanel.app/*` as allowed referrer; dismiss GitHub secret scanning alert as false positive |
| BL-002 | P1 | Deploy to Firebase App Hosting | 2026-05-24 | | Connect GitHub repo in Firebase Console; live URL unlocks BL-003. Deploy `firestore.rules` + indexes too (`firebase deploy --only firestore`) — the rules now deny all client access. Also add a Firestore TTL policy on collection `rateLimits`, field `expiresAt` (Console → Firestore → TTL), so rate-limit counters delete themselves. **Set the backend's runtime to `nodejs22` (or later) in App Hosting → Settings before deploying** — `package.json` now requires Node ≥22 (BL-029) and a mismatch fails the build |
| BL-031 | P1 | Post-deploy smoke test: Sonnet 5.5 + background runs | 2026-10-05 | | Never run against real Firebase Auth or the live Anthropic API. After BL-002: one panel per persona (tone, valid Synthesizer `tool_use`, title); start a debate and close the tab mid-run, reopen after a minute (should have progressed/finished); open the same panel in two tabs (one run only); /chat: quick reply, Debate, Debate this. All of this already passes against emulators + a fake model API — this is the real-services check |
| BL-003 | P1 | Set up Stripe webhook endpoint in production | 2026-05-24 | | After live URL known: add the endpoint `/api/stripe/webhook` in Stripe with events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`; set `stripe-webhook-secret` in Secret Manager. Test with `stripe trigger` (renewal, failed payment, cancel at period end) |
| BL-050 | P1 | Legal details for /privacy and /terms | 2026-11-01 | | Still needed in `lib/legal.ts`: operator's legal name, a dedicated contact address, governing law (the pages say "Draft" until then). Policy calls decided 2026-11-01: keep no refunds except where the law requires, 16+, notice before price changes. Have the pages reviewed before launch |
| BL-052 | P3 | MCP: OAuth sign-in for AI tools | 2026-11-01 | | **Decided 2026-11-01: after launch.** Today MCP clients use a personal API token from /account (docs/mcp.md). OAuth (Client ID Metadata Documents per the 2026-07-28 spec) would let users connect Claude/Cursor without copying a token, and enables directory listings |

---

## Done (last 5)

| ID | Title | Completed |
|----|-------|-----------|
| BL-051 | Compare follow-ups: type your own 2–3 options (chat, dashboard, MCP `options`); Pro compare debates add a revision round after the critique (shown as round 2; judge sees the revised options) | 2026-11-01 |
| BL-029 | firebase-admin 13 → 14 (with @google-cloud/firestore 7 → 9); Node ≥22 pinned via `engines.node` — user approved 2026-11-01 | 2026-11-01 |
| BL-049 | Share single debates: a Share button on chat debates and the panel page (confirm, copy link, Stop sharing); conversations stay private; privacy + terms updated | 2026-11-01 |
| BL-035 | Pro capped at 100 debates per 30 days, counted and refunded like free runs; dashboard/account show what's left; a Pro user at the cap gets the reset date, not the paywall | 2026-11-01 |
| BL-053 | Fixed for Claude Sonnet 5.5: the Synthesizer and compare Judge used a forced tool_choice (a 400 on Sonnet 5.5 — every real debate would have failed at the verdict) and token caps too small for default thinking; the fake model API now enforces these rules | 2026-11-01 |
