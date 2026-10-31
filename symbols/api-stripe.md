# Module: app/api/stripe

**Responsibility:** Stripe Checkout session creation and subscription webhook handling.

## Route Handlers

| Route | File | Responsibility |
|---|---|---|
| `POST /api/stripe/create-checkout` | create-checkout/route.ts | Auth required; 409 if already Pro. Checkout session (`mode: 'subscription'`), reuses the user's existing `stripeCustomerId` (else `customer_email`), stamps `uid` on both the session metadata and `subscription_data.metadata` (so later subscription events carry it). Success → `/dashboard?upgraded=1`. |
| `POST /api/stripe/webhook` | webhook/route.ts | Signature-verified (400 on missing/bad signature). Handles `checkout.session.completed` and `customer.subscription.created/updated/deleted` through `syncSubscription()`: retrieves the subscription's *current* state from Stripe (order-proof), maps it with `subscriptionFields()`, finds the user by uid metadata → subscription id → customer id, and writes tier/status/ids/currentPeriodEnd/cancelAtPeriodEnd in a transaction guarded by `shouldApply()`. Processing errors → 500 so Stripe retries. (BL-036, 2026-10-31) |
| `POST /api/stripe/portal` | portal/route.ts | Auth required. Reads `stripeCustomerId` off the user doc — 404 if absent (never subscribed). Creates a Stripe Billing Portal session (`return_url: {appUrl}/account`), returns `{ url }` for client-side redirect. Added 2026-09-14 for BL-023 (account/billing page). |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- Webhook signature verification happens before any Firestore access — correct order, do not reorder.
- Since 2026-10-31 every handled event re-reads the subscription from Stripe, so duplicates and out-of-order delivery converge; `shouldApply()` stops an old subscription's events from downgrading a newer one.
