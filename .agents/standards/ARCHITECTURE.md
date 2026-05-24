# Architecture Principles — AskPanel Web

---

## 1. Layered Architecture

```
┌─────────────────────────────────────────────┐
│  Presentation Layer                         │
│  Next.js pages, React components, hooks     │
│  (app/, components/, hooks/)               │
├─────────────────────────────────────────────┤
│  Domain Layer (optional)                    │
│  Agent orchestration, business logic        │
│  (lib/agents/)                             │
├─────────────────────────────────────────────┤
│  Data Layer                                 │
│  Firebase Firestore, Anthropic API, Stripe  │
│  (lib/firebase/, lib/anthropic.ts, etc.)   │
└─────────────────────────────────────────────┘
```

Data flows upward. Events flow downward. No layer communicates above itself.

### Layer Rules

| Rule | Description |
|------|-------------|
| **Dependency direction** | Data flows up; events flow down. No reverse edges. |
| **Data layer hides implementation** | Pages never import Firebase or Anthropic directly — they go through lib/ |
| **Single Source of Truth** | Panel state lives in Firestore. SSE delivers incremental updates; Firestore is canonical. |

---

## 2. Module Structure

```
app/
  api/           → Route handlers (server-only, no client imports)
  (app)/         → Auth-protected pages
  p/             → Public pages
components/      → React components (client-safe)
hooks/           → Client-side state hooks
lib/
  agents/        → Orchestration loop (server-only)
  firebase/      → Client + admin SDK (lazy init)
  anthropic.ts   → Anthropic client (lazy init)
  stripe.ts      → Stripe client (lazy init)
  auth.ts        → Session cookie helpers
types/           → Shared TypeScript types
proxy.ts         → Route protection (Next.js middleware)
```

### Module Dependency Rules

- `app/api/` → `lib/` only. Never imports from `components/` or `hooks/`.
- `components/` → may use `hooks/` and `types/`. No direct `lib/` imports.
- `hooks/` → browser APIs only. No Firebase Admin or Anthropic imports.
- `lib/agents/` → server-side only. Never imported by client components.

---

## 3. Next.js App Router Conventions

- **Server Components** (default): read-only, no interactivity, can use `adminDb()` directly.
- **Client Components** (`'use client'`): interactive, use hooks, no server-only imports.
- **API Routes**: always server-side. Long-running routes (SSE stream) need `timeoutSeconds: 300` in `apphosting.yaml`.

---

## 4. State Management

- **Server state**: Firestore (canonical). Read via Admin SDK in server components or route handlers.
- **Client state**: `usePanel` hook manages SSE-driven panel state. `useAuth` manages Firebase Auth session.
- No global client state store (Redux, Zustand, etc.) — not needed at this scale.

---

## 5. Error Handling

- API routes return structured JSON errors with appropriate HTTP status codes.
- SSE stream emits `{ type: 'error', message }` on failures; also updates Firestore `status: 'error'`.
- Client displays error state from either SSE or Firestore panel doc (whichever arrives first).
