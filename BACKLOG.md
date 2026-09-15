# Backlog — AskPanel

> Managed by AI Agent. Updated at task-completion. Line count checked at session start.
> P0 = do next session | P1 = this sprint | P2 = someday/nice-to-have
> ID format: BL-NNN (sequential, never reused). Done section capped at 5 entries.
> Jira Ticket: populate when a Jira ticket exists for this item. Leave blank if unplanned in Jira.

| ID | Priority | Title | Added | Jira Ticket | Notes |
|----|----------|-------|-------|-------------|-------|
| BL-004 | P0 | Add GCP HTTP referrer restrictions to Firebase API key | 2026-05-25 | | In GCP Console → Credentials → browser key, add `https://askpanel.app/*` as allowed referrer; dismiss GitHub secret scanning alert as false positive |
| BL-002 | P1 | Deploy to Firebase App Hosting | 2026-05-24 | | Connect GitHub repo in Firebase Console; live URL unlocks BL-003 |
| BL-003 | P1 | Set up Stripe webhook endpoint in production | 2026-05-24 | | After live URL known; add webhook in Stripe dashboard, set `stripe-webhook-secret` in Secret Manager |
| BL-028 | P2 | Deliberate upgrade: @anthropic-ai/sdk | 2026-09-14 | | ^0.98.0 installed, 0.125.0 latest — pre-1.0, ~27 minors behind. Review release notes, plan a dedicated upgrade + full regression test of the panel run flow. See DEPENDENCY_ALERTS DA-003 |
| BL-029 | P3 | Deliberate upgrade: firebase-admin | 2026-09-14 | | ^13.10.0 installed, 14.4.0 latest — one major behind. See DEPENDENCY_ALERTS DA-004 |

---

## Done (last 5)

| ID | Title | Completed |
|----|-------|-----------|
| BL-027 | Corrected "Next.js 15"/"Node 25" doc references (actual: Next.js 16.2.6) | 2026-09-15 |
| BL-026 | Fixed shared Textarea primitive (removed field-sizing-content bug) | 2026-09-15 |
| BL-025 | Follow-up panels inherit parent's privacy setting | 2026-09-15 |
| BL-024 | Fixed SSRF DNS-rebinding gap in context extraction | 2026-09-15 |
| BL-023 | Usage/billing account page + Stripe billing portal | 2026-09-14 |
