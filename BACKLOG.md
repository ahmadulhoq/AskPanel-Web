# Backlog — AskPanel

> Managed by AI Agent. Updated at task-completion. Line count checked at session start.
> P0 = do next session | P1 = this sprint | P2 = someday/nice-to-have
> ID format: BL-NNN (sequential, never reused). Done section capped at 5 entries.
> Jira Ticket: populate when a Jira ticket exists for this item. Leave blank if unplanned in Jira.

| ID | Priority | Title | Added | Jira Ticket | Notes |
|----|----------|-------|-------|-------------|-------|
| BL-001 | P0 | Run cartographer workflow to build codebase memory | 2026-05-24 | | Setup prerequisite |
| BL-004 | P0 | Rotate exposed Firebase API key & add GCP restrictions | 2026-05-25 | | Key `AIzaSyCATAGc0Qq...` committed in plain text in 9f2f479d; rotate in GCP Console, apply HTTP referrer + API restrictions, move to Secret Manager in apphosting.yaml, dismiss GitHub secret scanning alert |
| BL-005 | P0 | Fix inert Share button on panel page | 2026-05-31 | | `id="share-btn"` exists in the DOM with a `data-share-url` attribute but has no JS handler — clicking it does nothing. Should copy link to clipboard or open native share sheet |
| BL-002 | P1 | Deploy to Firebase App Hosting | 2026-05-24 | | Requires GitHub connection via Firebase Console |
| BL-003 | P1 | Set up Stripe webhook endpoint in production | 2026-05-24 | | After live URL known |
| BL-006 | P1 | Add sign-out button to dashboard | 2026-05-31 | | `signOut()` exists in `useAuth` but is not surfaced anywhere in the UI; users are trapped until the 14-day session cookie expires |
| BL-007 | P1 | Privacy toggle — let users make a panel private | 2026-05-31 | | Schema has `isPublic` but it is hardcoded to `true` in POST /api/panels. Add a checkbox to PanelInput. High-stakes users (career, health, legal questions) need this before they'll trust the product |
| BL-008 | P1 | Copy final answer to clipboard | 2026-05-31 | | Single button on FinalAnswer component; the answer is long-form markdown and users need to take it somewhere else to act on it |
| BL-009 | P1 | Suggested starter questions / example chips on dashboard | 2026-05-31 | | New users land on a blank textarea with no guidance. 5–6 clickable example questions (career, business, technical, ethical) reduce time-to-first-run and demonstrate what the product is for |
| BL-010 | P1 | Reconnect mid-run: replay stored rounds on SSE open | 2026-05-31 | | If user navigates away during a run, reconnecting opens a new stream but in-progress turns stored in Firestore are never replayed. Must seed PanelThread with existing `rounds[]` data before the SSE takes over |
| BL-011 | P1 | Follow-up question composer after panel completes | 2026-05-31 | | After reading a final answer the user has nowhere to go. Show a second PanelInput pre-seeded with the original question + final answer as context so users can drill deeper without starting from scratch |
| BL-012 | P1 | Auto-generated panel title for dashboard history | 2026-05-31 | | Dashboard truncates the raw question to ~60 chars which reads poorly for longer questions. Call Claude once post-completion to produce a 5–8 word title; store as `panels/{id}.title` |
| BL-013 | P1 | Domain-specific panel personas (Respondent/Critic role prompts) | 2026-05-31 | | PaywallDialog already promises "all personas" and "custom personas" as Pro features. Pre-defined sets: General (current), Startup Advisor, Devil's Advocate, Legal Lens, Technical Audit. Each is just a different system prompt passed to orchestrator. Gate custom personas behind Pro |
| BL-014 | P2 | Monthly run reset — change free limit from lifetime to monthly | 2026-05-31 | | `freeRunsUsed` is a lifetime counter and never resets. A user who tried the product during evaluation and hit 5 runs can never return without paying. Switch to a monthly bucket (5 runs / month, reset on billing date) to allow re-evaluation. Requires a `freeRunsResetAt` Timestamp on the user doc |
| BL-015 | P2 | File / URL context input | 2026-05-31 | | PaywallDialog lists "File upload (coming soon)". Let users paste a URL or upload a PDF/text file; extract text server-side and prepend as context to the question sent to the orchestrator. Pro-only |
| BL-016 | P2 | Panel export — download as Markdown or PDF | 2026-05-31 | | Target use case: user pressure-tests a strategy and wants to share the full deliberation with colleagues. A "Download" button on the completed panel page. Markdown is trivial (concatenate turns); PDF via a headless render or `@react-pdf/renderer` |
| BL-017 | P2 | Onboarding tour for new users | 2026-05-31 | | First-time users don't know what Respondent / Critic / Synthesizer are. A one-time tooltip sequence (or a short "how it works" panel before first run) anchored to the live thread would set expectations and reduce churn after the first confusing result |
| BL-018 | P2 | Public panel discovery / gallery | 2026-05-31 | | All panels are public by default. A curated or algorithmic gallery of interesting deliberations could be a growth loop — users share panels, readers discover the product. Needs moderation strategy before shipping |
| BL-019 | P2 | User-configurable max rounds (1–3) | 2026-05-31 | | `maxRounds` is hardcoded to 2 in POST /api/panels. Simple questions should resolve in 1 round (faster, cheaper). Complex ones may need 3. Expose as an advanced option; cap at 3 for Pro, 1 for free |
| BL-020 | P2 | Account management page (cancel subscription, delete account) | 2026-05-31 | | No account page exists. Users who want to cancel have no self-serve path. Stripe customer portal redirect covers cancellation; account deletion needs Firestore + Firebase Auth cleanup |

---

## Done (last 5)

| ID | Title | Completed |
|----|-------|-----------|
