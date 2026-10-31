# Module: lib/firebase

**Responsibility:** Firebase client + admin SDK initialization, both lazily constructed.

## Functions

| Name | File | Responsibility |
|---|---|---|
| `getAdminApp()` | admin.ts | Internal — lazily initializes the Firebase Admin `App` via `cert()` credentials from env vars. Reuses existing app if `getApps().length > 0` (hot-reload safety). |
| `adminAuth()` | admin.ts | Returns Admin `Auth` instance — used for session cookie create/verify |
| `adminDb()` | admin.ts | Returns Admin `Firestore` instance — used everywhere server-side for reads/writes |
| `getApp()` | client.ts | Internal — lazily initializes the browser Firebase `App` from `NEXT_PUBLIC_*` env vars |
| `getFirebaseAuth()` | client.ts | Returns client-side `Auth` — used by `useAuth`/`AuthForm` for sign-in |

## Notes / Findings
- `admin.ts` line 15: `process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')` — see SACRED S004 (looks like a hack, is required because env vars encode newlines as literal `\n`).
- Both files follow the lazy-singleton pattern (module-level `let`, populate-on-first-call) — see SACRED S005.
- Client and Admin SDKs are never imported into the same file — clean separation between server-only and browser-only code.
- `getFirebaseDb()` removed 2026-10-31: the browser never uses Firestore (rules deny all client access). Don't re-add client Firestore access.
