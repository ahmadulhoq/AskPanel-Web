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
| BL-021 | P2 | File upload for context (Pro) | 2026-05-31 | | PDF + .txt upload alongside existing URL-fetch; parse server-side, same 4000-char cap |
| BL-022 | P2 | Dashboard panel search & filter | 2026-05-31 | | Filter by persona, status, date range; client-side on the 20-item list is fine |
| BL-023 | P2 | Usage / billing page for Pro users | 2026-05-31 | | Show run count, subscription renewal date, link to Stripe customer portal |

---

## Done (last 5)

| ID | Title | Completed |
|----|-------|-----------|
| BL-020 | Custom persona builder (Pro) | 2026-06-01 |
| BL-019 | Configurable max rounds 1–3 (Pro gate on round 3) | 2026-05-31 |
| BL-016 | Panel export as Markdown download | 2026-05-31 |
| BL-015 | URL + text context injection (Pro only) | 2026-05-31 |
| BL-014 | Follow-up question composer with parent context | 2026-05-31 |
| BL-013 | Persona selector — 5 personas, Pro gate on 3 | 2026-05-31 |
