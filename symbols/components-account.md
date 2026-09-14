# Module: components/account

**Responsibility:** Billing portal redirect control for the account page. Added 2026-09-14 for BL-023.

## Components

| Name | File | Responsibility |
|---|---|---|
| `BillingPortalButton` | BillingPortalButton.tsx | Client component. Calls `POST /api/stripe/portal`, redirects (`window.location.href`) to the returned Stripe Billing Portal URL on success. Shows an inline error message on failure (network error or non-2xx response), does not throw. |

## Notes / Findings
- No FIXME/TODO/HACK comments found. New, minimal module.
