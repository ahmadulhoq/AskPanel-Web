# Module: app (root)

**Responsibility:** Root layout (fonts, HTML shell) and the marketing landing page.

## Pages

| Name | File | Responsibility |
|---|---|---|
| `RootLayout` | layout.tsx | Loads Geist Sans/Mono via `next/font/google`, sets root `<html>`/`<body>` shell and default `metadata` (title/description). |
| `LandingPage` | page.tsx | Static marketing page — nav with sign-in/get-started links, hero copy, a 3-card "you use X for Y, you use AskPanel for Z" positioning section. No data fetching. |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
