# Module: root config

**Responsibility:** Route protection middleware and Next.js build config.

## Functions

| Name | File | Responsibility |
|---|---|---|
| `proxy(request)` | proxy.ts | Next.js 15 middleware (renamed from `middleware.ts`/`middleware`, exported as `proxy` — see SACRED-adjacent stack constraint in `.claude/rules/repo-rules.md`). Lightweight cookie-presence-only check on `/dashboard/*` and `/panel/*` — redirects to `/login` if the `__session` cookie is entirely absent. Does NOT verify the cookie's signature/validity (see SACRED S008 for why that's intentional and where the deeper check happens). |
| `config.matcher` | proxy.ts | `['/dashboard/:path*', '/panel/:path*']` — the actual route-matching mechanism Next.js uses (the `PROTECTED` array inside the function body is a secondary, redundant-looking check against `pathname.startsWith()` — see finding below) |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- `next.config.ts` is the default scaffold with no custom options — nothing to document.
- Minor observation (not flagged as TECH_DEBT, too trivial): `proxy.ts` has two overlapping protection declarations — the `PROTECTED` array checked via `pathname.startsWith()` inside the function, AND the `config.matcher` glob pattern that Next.js uses to decide whether to invoke the middleware at all. They currently agree (`/dashboard`, `/panel`), but if one is ever updated without the other, protection could silently diverge (matcher not invoking the function at all for a path is very different from the function running and returning `NextResponse.next()`). Worth being aware of when adding a new protected route — update both.
