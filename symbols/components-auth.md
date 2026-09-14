# Module: components/auth

**Responsibility:** Sign-in/sign-up form and sign-out control.

## Components

| Name | File | Responsibility |
|---|---|---|
| `AuthForm` | AuthForm.tsx | Google OAuth button (`signInWithGoogle`) + email/password form toggling between sign-in/sign-up mode (`useAuth()`). On success, `router.push('/dashboard')`. Includes an inline `GoogleIcon` SVG sub-component (not exported, local to this file). |
| `SignOutButton` | SignOutButton.tsx | Calls `useAuth().signOut()` then `router.push('/login')`. |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- `AuthForm`'s password field has `minLength={8}` as an HTML attribute only — there's no matching server-side password length validation surfaced anywhere in this codebase (Firebase Auth itself enforces its own minimum, typically 6 chars, so the client-side `minLength={8}` is a UX nicety, not a security boundary — Firebase is the actual enforcement point). Not flagged as a bug since Firebase Auth is the real authority here.
