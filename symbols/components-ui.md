# Module: components/ui

**Responsibility:** shadcn/ui primitives — thin styled wrappers over `@base-ui/react` components plus `class-variance-authority` for variant styling. Not project-specific business logic; documented at module level rather than exhaustively per internal prop.

## Components

| Name | File | Responsibility |
|---|---|---|
| `Button`, `buttonVariants` | button.tsx | Wraps `@base-ui/react/button`. Variants: default/outline/secondary/ghost/destructive/link. Sizes: default/xs/sm/lg/icon/icon-xs/icon-sm/icon-lg. |
| `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` | dialog.tsx | Wraps `@base-ui/react/dialog`. Used by `PaywallDialog` and `CustomPersonaEditor`. |
| `Badge`, `badgeVariants` | badge.tsx | Variants: default/secondary/destructive/outline/ghost/link. Used by `ConfidenceBadge` and directly in `PanelList`/dashboard for status pills. |
| `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` | card.tsx | Used by `AuthForm` as the sign-in/sign-up container. |
| `Input` | input.tsx | Wraps `@base-ui/react/input`. Used by `AuthForm` (email/password fields). |
| `Label` | label.tsx | Plain styled `<label>`. Used by `AuthForm`. |
| `Separator` | separator.tsx | Wraps `@base-ui/react/separator`. Used by `AuthForm` (the "or" divider between Google and email sign-in). |
| `Toaster` | sonner.tsx | Wraps the `sonner` toast library with theme-aware icons via `next-themes`. **Not currently rendered anywhere** (no `<Toaster />` found in `app/layout.tsx` or elsewhere) — see finding below. |
| `Textarea` | textarea.tsx | Still unused by any current call site, but the `field-sizing-content` bug is fixed (removed 2026-09-15, BL-026 — see LESSONS.md Lesson 001 / TECH_DEBT Resolved TD-004). Now a plain min-height textarea with no auto-grow — composer components remain responsible for their own JS-controlled resize if they need auto-grow. |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- `Toaster` (sonner.tsx) is a complete, styled component but is never mounted (`app/layout.tsx` doesn't render `<Toaster />`), and no component anywhere calls `toast(...)` from the `sonner` package. This is dead scaffolding — either intentionally kept for a planned future feature (e.g. toast notifications for background events like title generation completing) or leftover shadcn boilerplate never wired up. Not flagged as urgent TECH_DEBT (zero risk, just unused), but noted here so it's not mistaken for "already working" if a future feature wants toast notifications.
- `Textarea` — see TECH_DEBT.md Resolved TD-004, LESSONS.md Lesson 001.
- These are otherwise standard shadcn/ui-generated files; not scanned for FIXME-style findings beyond what's noted, per the cartographer's judgment that boilerplate primitives carry low findings-density relative to reading effort.
