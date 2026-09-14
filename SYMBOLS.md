# Symbol Index: askpanel-web
> Split mode — 20 modules. Full symbols live in `.memory/symbols/[module-name].md`.
> Last updated: 2026-09-14T00:00Z by Cartographer Agent (+ BL-023 incremental update)

| Module | Files | Responsibility (one line) | Symbols file |
|---|---|---|---|
| lib-agents | 5 | Multi-agent orchestration loop — Respondent/Critic/Synthesizer, prompt building, personas, title generation | `symbols/lib-agents.md` |
| lib-firebase | 2 | Firebase client + admin SDK init (lazy singletons) | `symbols/lib-firebase.md` |
| lib-core | 4 | Anthropic/Stripe lazy clients, session auth helpers, className merge | `symbols/lib-core.md` |
| api-panels | 4 | Panel creation, SSE stream + reconnection replay, export, retry | `symbols/api-panels.md` |
| components-account | 1 | Billing portal redirect button | `symbols/components-account.md` |
| api-context | 2 | Pro-only context extraction — URL fetch + file upload | `symbols/api-context.md` |
| api-auth | 1 | Session cookie exchange (login/logout) | `symbols/api-auth.md` |
| api-stripe | 3 | Checkout session creation, billing portal, subscription webhook | `symbols/api-stripe.md` |
| api-user | 1 | Custom persona CRUD | `symbols/api-user.md` |
| app-protected-pages | 4 | Dashboard, individual panel view, account/billing page (auth-gated) | `symbols/app-protected-pages.md` |
| app-auth-pages | 1 | Login page | `symbols/app-auth-pages.md` |
| app-public-share | 1 | Public unauthenticated panel share view | `symbols/app-public-share.md` |
| app-root | 2 | Root layout + marketing landing page | `symbols/app-root.md` |
| hooks | 2 | `useAuth()`, `usePanel()` — client-side auth + live SSE panel state | `symbols/hooks.md` |
| types | 1 | Shared domain types — Firestore doc shapes, SSE event union, client state shapes | `symbols/types.md` |
| root-config | 2 | `proxy.ts` route-protection middleware, `next.config.ts` | `symbols/root-config.md` |
| components-panel | 14 | Panel view UI — thread, composer, persona/context/rounds controls, result presentation | `symbols/components-panel.md` |
| components-dashboard | 4 | Dashboard composition — panel history search/filter, composer wrapper | `symbols/components-dashboard.md` |
| components-auth | 2 | Sign-in/sign-up form, sign-out button | `symbols/components-auth.md` |
| components-ui | 9 | shadcn/ui primitives (Button, Dialog, Badge, Card, Input, Label, Separator, Toaster, Textarea) | `symbols/components-ui.md` |

**Total: 20 modules, 64 source files.** Coverage gate passed 2026-09-14 — every directory in a fresh `find` enumeration mapped to a processed module, 0 remaining. (BL-023, same day, added 3 files: `app/(app)/account/page.tsx`, `app/api/stripe/portal/route.ts`, `components/account/BillingPortalButton.tsx` — tracked incrementally above rather than re-running the full workflow.)

See `.memory/MAP.md` for architecture pattern, module registry with key entry points, and critical business logic flows in detail.
