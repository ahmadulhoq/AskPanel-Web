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
| BL-024 | P2 | Fix SSRF DNS-rebinding gap in context extraction | 2026-09-14 | | `isPrivateHost()` in `app/api/context/extract/route.ts` checks literal hostname, not resolved IP — see TECH_DEBT TD-001 |
| BL-025 | P2 | Inherit privacy setting on follow-up panels | 2026-09-14 | | `FollowUpComposer` hardcodes `isPublic: true` instead of the parent panel's actual setting — see TECH_DEBT TD-003 |
| BL-026 | P3 | Fix or remove unused shared Textarea primitive | 2026-09-14 | | `components/ui/textarea.tsx` still has the original jumping-textarea bug (`field-sizing-content`) and is unused — see TECH_DEBT TD-004, LESSONS Lesson 001 |
| BL-027 | P2 | Correct "Next.js 15" / "Node 25" references in repo docs | 2026-09-14 | | Actual runtime is Next.js 16.2.6 / Node v22.22.2 — see DEPENDENCY_ALERTS DA-001/DA-002 |

---

## Done (last 5)

| ID | Title | Completed |
|----|-------|-----------|
| BL-023 | Usage/billing account page + Stripe billing portal | 2026-09-14 |
| BL-022 | Dashboard panel search & filter | 2026-09-14 |
| BL-021 | File upload for context (Pro) | 2026-09-14 |
| BL-020 | Custom persona builder (Pro) | 2026-06-01 |
| BL-019 | Configurable max rounds 1–3 (Pro gate on round 3) | 2026-05-31 |
