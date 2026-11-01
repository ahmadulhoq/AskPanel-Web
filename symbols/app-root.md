# Module: app (root)

**Responsibility:** Root layout (fonts, HTML shell) and the marketing landing page.

## Pages

| Name | File | Responsibility |
|---|---|---|
| `RootLayout` | layout.tsx | Loads Geist Sans/Mono via `next/font/google`, sets root `<html>`/`<body>` shell and default `metadata` (title/description). |
| `LandingPage` | page.tsx | Static marketing page — nav with sign-in/get-started links, hero copy, a 3-card "you use X for Y, you use AskPanel for Z" positioning section. No data fetching. |

## Notes / Findings
- No FIXME/TODO/HACK comments found.

- 2026-11-01 (BL-040): `/privacy` and `/terms` (public; `components/legal/LegalPage.tsx` shell with a Draft notice while `lib/legal.ts` is unfilled — written from what the code does: keep in sync when data handling changes). `components/SiteFooter.tsx` (Privacy · Terms) on landing, login, account, legal pages; login notes agreement to the terms. Page `<main>`s use `w-full` — in the flex-column body, `mx-auto` alone shrank them to their content.
