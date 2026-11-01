# Symbol Index: askpanel-web
> Split mode — 26 modules. Full symbols live in `.memory/symbols/[module-name].md`.
> Last updated: 2026-11-01 (incremental: CI/e2e, chat settings/Stop/summary, launch basics)

| Module | Files | Responsibility (one line) | Symbols file |
|---|---|---|---|
| lib-agents | 7 | Debate engine (resumable, lease-checked writes), background runner, resume logic, prompts, personas, titles | `symbols/lib-agents.md` |
| lib-firebase | 2 | Firebase client + admin SDK init (lazy singletons) | `symbols/lib-firebase.md` |
| lib-core | 4 | Anthropic/Stripe lazy clients, session auth helpers, className merge | `symbols/lib-core.md` |
| lib-billing | 3 | Run/reply allowances, Stripe subscription mapping | `symbols/lib-billing.md` |
| lib-conversations | 4 | v2 conversation store, model context, quick replies, titles | `symbols/lib-conversations.md` |
| lib-panels | 2 | Panel creation (+ runner start), stored state → SSE event diff | `symbols/lib-panels.md` |
| api-panels | 4 | Panel creation (reserves the run), SSE stream that tails Firestore and starts the runner, export, retry | `symbols/api-panels.md` |
| components-account | 1 | Billing portal redirect button | `symbols/components-account.md` |
| api-context | 2 | Pro-only context extraction — URL fetch + file upload | `symbols/api-context.md` |
| api-auth | 1 | Session cookie exchange (login/logout) | `symbols/api-auth.md` |
| api-stripe | 3 | Checkout session creation, billing portal, subscription webhook | `symbols/api-stripe.md` |
| api-conversations | 3 | v2 conversations: create, message (reply stream / debate), Debate this | `symbols/api-conversations.md` |
| api-user | 1 | Custom persona CRUD | `symbols/api-user.md` |
| app-protected-pages | 6 | Dashboard, panel view, account page, chat list + conversation (auth-gated) | `symbols/app-protected-pages.md` |
| app-auth-pages | 1 | Login page | `symbols/app-auth-pages.md` |
| app-public-share | 1 | Public unauthenticated panel share view | `symbols/app-public-share.md` |
| app-root | 2 | Root layout + marketing landing page | `symbols/app-root.md` |
| hooks | 2 | `useAuth()`, `usePanel()` — client-side auth + live SSE panel state | `symbols/hooks.md` |
| types | 1 | Shared domain types — Firestore doc shapes, SSE event union, client state shapes | `symbols/types.md` |
| root-config | 2 | `proxy.ts` route-protection middleware, `next.config.ts` | `symbols/root-config.md` |
| components-panel | 15 | Panel view UI — thread, composer, persona/context/rounds controls, result presentation | `symbols/components-panel.md` |
| components-dashboard | 4 | Dashboard composition — panel history search/filter, composer wrapper | `symbols/components-dashboard.md` |
| components-chat | 5 | v2 chat UI: composer, reply, debate block, conversation view | `symbols/components-chat.md` |
| components-auth | 2 | Sign-in/sign-up form, sign-out button | `symbols/components-auth.md` |
| components-ui | 9 | shadcn/ui primitives (Button, Dialog, Badge, Card, Input, Label, Separator, Toaster, Textarea) | `symbols/components-ui.md` |

**Total: 26 modules, 88 source files (+5 test files).** 2026-10-31 additions: runner/runState, lib/billing (runs, replies, subscription), lib/panels (create, streamDiff), lib/conversations, lib/sse, components/chat, chat pages, conversation routes. Removed: `getFirebaseDb`, `replayRounds`, react-markdown.

See `.memory/MAP.md` for architecture pattern, module registry with key entry points, and critical business logic flows in detail.
