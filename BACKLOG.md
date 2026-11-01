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
| BL-035 | P1 | Decide the Pro run cap | 2026-10-30 | | Upgrade dialog promises "100 panel runs / month"; code gives Pro unlimited runs. Either enforce a cap or fix the copy (audit #5). Needs a pricing decision — see v2 spec §8, §13 |
| BL-037 | P1 | Decide `cpuAlwaysAllocated` | 2026-10-31 | | On (current): debates finish while users are away; CPU billed for instance lifetime. Off: cheaper; unwatched debates pause and resume on return. v2 spec §13.5 |
| BL-050 | P1 | Legal details for /privacy and /terms | 2026-11-01 | | Fill in `lib/legal.ts` (operator's legal name, contact email, governing law) — the pages show a "Draft" notice until then. Both pages were written from what the code does; have them reviewed (refund policy, age limit 16, price-change notice are placeholders for your call) |
| BL-047 | P1 | Decide quick-reply limits and model | 2026-10-31 | | Free users get 30 quick replies/day — a placeholder (`lib/billing/replies.ts`). Also whether replies (and the rolling-summary call, `lib/conversations/summary.ts`) use Sonnet 5.5 (current) or a cheaper model — the reply model is now also the coordinator that decides when to debate, so a cheaper model means worse routing; check the `routingEvents` override rate. v2 spec §13.1–13.2 |
| BL-049 | P2 | Decide conversation sharing | 2026-11-01 | | Chat debates are private (`isPublic: false`); conversations can't be shared. Share the whole conversation, single verdicts, or nothing? v2 spec §13.4 |
| BL-051 | P3 | Compare mode follow-ups | 2026-11-01 | | Spec §7.3 items not in the first version: a Pro second round where proposers revise after the critique; let users type their own options (today proposers take options named in the question, else invent them); compare in the MCP tools (BL-045) |
| BL-044 | P2 | v2 M4: migrate v1 panels, conversation-list dashboard, launch | 2026-10-31 | | Spec §10 |
| BL-045 | P2 | v2 M5: MCP server (plugin distribution) | 2026-10-31 | | Async `start_debate` / `get_debate_result` tools; OAuth; links back to transcripts (spec §11) |
| BL-029 | P3 | Deliberate upgrade: firebase-admin 13 → 14 (major) | 2026-09-14 | | Major upgrade — needs approval per repo rules. **Plan ready (2026-10-05):** trial-installed 14.5.0 locally — `tsc` and `next build` both pass, no code changes needed. Only open question: v14 requires **Node ≥22** — confirm the App Hosting runtime is Node 22+ before applying. See DEPENDENCY_ALERTS DA-004 |

---

## Done (last 5)

| ID | Title | Completed |
|----|-------|-----------|
| BL-042 | v2 M2: the chat assistant decides when to convene the panel (`convene_panel`); free tier gets a Run / Just answer card, Pro starts automatically; every decision and override logged | 2026-11-01 |
| BL-043 | v2 M3: Compare options — 3 proposers, a critic, a judge that names a winner with scores; dashboard + chat, share page, export, Stop/resume | 2026-11-01 |
| BL-040 | Launch basics: privacy + terms pages (drafts), delete account / panel / conversation, dashboard "Show more", rate limits on debates, replies, context and sign-in | 2026-11-01 |
| BL-048 | Chat debates: persona + rounds (remembered per conversation), Stop button (refund before round-1 verdict), rolling summary for long conversations; Pro personas now enforced server-side | 2026-11-01 |
| BL-038 | CI (lint, unit, build, e2e on every PR), e2e suite committed (`npm run e2e`), lint clean, paywall says "Pro feature" for locked controls | 2026-11-01 |
