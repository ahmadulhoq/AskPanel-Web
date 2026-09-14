# Module: app/api/auth

**Responsibility:** Session cookie lifecycle — exchanges a Firebase ID token for the `__session` cookie, upserts the user doc on first login.

## Route Handlers

| Route | File | Responsibility |
|---|---|---|
| `POST /api/auth/session` | session/route.ts | Verifies the client-supplied Firebase ID token via `adminAuth().verifyIdToken()`. Creates the session cookie (`createSessionCookie()`). On first login (user doc doesn't exist), creates it with default `freeRunsUsed: 0` and `subscription.tier: 'free'`. Sets the `__session` cookie (`httpOnly`, `secure` in production, `sameSite: 'lax'`, 14-day maxAge). |
| `DELETE /api/auth/session` | session/route.ts | Clears the `__session` cookie — sign-out. |

## Notes / Findings
- **Minor style nit (low-severity TECH_DEBT):** two separate `import` statements from `@/lib/firebase/admin` on consecutive lines (`adminDb` then `adminAuth`) instead of one combined `import { adminDb, adminAuth } from ...`. Purely cosmetic, zero functional impact — logged in TECH_DEBT.md as a trivial cleanup, not worth a dedicated task.
- New-user doc does NOT set `freeRunsResetAt` or `customPersona` at creation — both are read with `?? null`/`?? 0` fallbacks everywhere they're used (`POST /api/panels`, `app/(app)/dashboard/page.tsx`), so this is safe, not a bug. Noting it so a future schema change doesn't assume these fields are always present from creation.
