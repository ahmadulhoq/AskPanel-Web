# Backlog — AskPanel

> Managed by AI Agent. Updated at task-completion. Line count checked at session start.
> P0 = do next session | P1 = this sprint | P2 = someday/nice-to-have
> ID format: BL-NNN (sequential, never reused). Done section capped at 5 entries.
> Jira Ticket: populate when a Jira ticket exists for this item. Leave blank if unplanned in Jira.

| ID | Priority | Title | Added | Jira Ticket | Notes |
|----|----------|-------|-------|-------------|-------|
| BL-030 | P0 | Migrate off `claude-sonnet-4-5` before its Nov 30, 2026 end-of-life | 2026-10-05 | | `DEFAULT_MODEL` in `lib/anthropic.ts` drives all three agents + title generation. SDK 0.131 lists it as deprecated, EOL 2026-11-30 — after that every panel run fails. Needs a product decision on the replacement model (cost/quality), then a regression pass on persona prompts |
| BL-004 | P0 | Add GCP HTTP referrer restrictions to Firebase API key | 2026-05-25 | | In GCP Console → Credentials → browser key, add `https://askpanel.app/*` as allowed referrer; dismiss GitHub secret scanning alert as false positive |
| BL-002 | P1 | Deploy to Firebase App Hosting | 2026-05-24 | | Connect GitHub repo in Firebase Console; live URL unlocks BL-003 |
| BL-003 | P1 | Set up Stripe webhook endpoint in production | 2026-05-24 | | After live URL known; add webhook in Stripe dashboard, set `stripe-webhook-secret` in Secret Manager |
| BL-029 | P3 | Deliberate upgrade: firebase-admin 13 → 14 (major) | 2026-09-14 | | Major upgrade — needs approval per repo rules. **Plan ready (2026-10-05):** trial-installed 14.5.0 locally — `tsc` and `next build` both pass, no code changes needed (we already use the ES-module entry points v14 requires; none of the removed APIs — legacy namespace, FCM legacy types, Instance ID — are used). Only open question: v14 requires **Node ≥22** — confirm the App Hosting runtime is Node 22+ before applying. See DEPENDENCY_ALERTS DA-004 |

---

## Done (last 5)

| ID | Title | Completed |
|----|-------|-----------|
| BL-028 | Upgraded @anthropic-ai/sdk 0.98 → 0.131 (no breaking changes affecting our usage) | 2026-10-05 |
| BL-027 | Corrected "Next.js 15"/"Node 25" doc references (actual: Next.js 16.2.6) | 2026-09-15 |
| BL-026 | Fixed shared Textarea primitive (removed field-sizing-content bug) | 2026-09-15 |
| BL-025 | Follow-up panels inherit parent's privacy setting | 2026-09-15 |
| BL-024 | Fixed SSRF DNS-rebinding gap in context extraction | 2026-09-15 |
