# Module: app/api/stripe

**Responsibility:** Stripe Checkout session creation and subscription webhook handling.

## Route Handlers

| Route | File | Responsibility |
|---|---|---|
| `POST /api/stripe/create-checkout` | create-checkout/route.ts | Auth required. Creates a Stripe Checkout session (`mode: 'subscription'`, price = `STRIPE_PRO_PRICE_ID`), pre-fills `customer_email`, stamps `metadata: { uid: user.uid }` (used by the webhook to map back to the Firestore user). Redirects to `/dashboard?upgraded=1` on success, `/dashboard` on cancel. Returns `{ url: session.url }` for client-side redirect. |
| `POST /api/stripe/webhook` | webhook/route.ts | No user auth — authenticated via Stripe signature verification (`getStripe().webhooks.constructEvent()` against `STRIPE_WEBHOOK_SECRET`; 400 on bad signature). Handles `checkout.session.completed` (upgrades user to `tier: 'pro'`, stores `stripeCustomerId`/`stripeSubscriptionId`/`currentPeriodEnd`; idempotency check skips if `stripeSubscriptionId` already matches) and `customer.subscription.deleted` (downgrades to `tier: 'free'`, finds the user via `where('subscription.stripeSubscriptionId', '==', ...)` since there's no uid in this event's metadata). |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- Webhook signature verification happens before any Firestore access — correct order, do not reorder.
- `checkout.session.completed` has an explicit idempotency guard (skip if already applied); `customer.subscription.deleted` does not have an equivalent explicit guard, but its write is naturally idempotent (setting tier to `'free'` / nulling subscription fields twice has the same end state) — not flagged as a bug.
