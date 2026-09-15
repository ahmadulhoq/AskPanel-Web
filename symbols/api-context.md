# Module: app/api/context

**Responsibility:** Pro-only context extraction for panel questions — URL fetch and file upload, both normalized to plain text capped at 4000 chars.

## Route Handlers

| Route | File | Responsibility |
|---|---|---|
| `POST /api/context/extract` | extract/route.ts | Pro-gated. Validates URL is well-formed and `http:`/`https:` only. Blocks private/loopback/link-local/cloud-metadata hosts by resolving DNS and checking every returned IP (`resolvesToPrivateAddress()`, fixed 2026-09-15 for BL-024 — previously only checked the literal hostname string, a DNS-rebinding gap). Fetches via `safeFetch()`, which follows redirects manually (max 3 hops) and re-validates the hostname/IP at every hop. Strips HTML via `stripHtml()` if `content-type` is `text/html`, otherwise accepts any `text/*`. Truncates to 4000 chars. |
| `POST /api/context/upload` | upload/route.ts | Pro-gated. Accepts multipart form data, field name `file`. 5 MB size cap. Accepts `.txt`/`.md` (read directly as text) and `.pdf` (parsed via `pdf-parse`'s `PDFParse` class, dynamically imported). Truncates to 4000 chars. |

## Internal Helpers

| Name | File | Responsibility |
|---|---|---|
| `isPrivateIp(address)` | extract/route.ts | Checks a literal IP string against loopback/link-local/cloud-metadata/RFC1918 private ranges (IPv4 + basic IPv6 unique-local/link-local prefixes) |
| `isPrivateHost(hostname)` | extract/route.ts | `localhost` check + delegates to `isPrivateIp()` for literal-IP hostnames |
| `resolvesToPrivateAddress(hostname)` | extract/route.ts | Async — resolves the hostname via `dns.promises.lookup(hostname, { all: true })` and checks every returned address with `isPrivateIp()`. DNS resolution failure is treated as unsafe (fails closed, not open). |
| `safeFetch(startUrl)` | extract/route.ts | Fetches with `redirect: 'manual'` and manually follows up to `MAX_REDIRECTS` (3) hops, calling `resolvesToPrivateAddress()` on each hop's hostname before following it. Throws `SSRFError` (caught in the route handler, mapped to a 400) if any hop is private/reserved or the redirect budget is exceeded. |
| `stripHtml(html)` | extract/route.ts | Removes `<script>`/`<style>` blocks, strips remaining tags, decodes common HTML entities, collapses whitespace |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- The DNS-rebinding gap and the fetch-auto-follows-redirects-without-revalidation gap (TD-001, both closed 2026-09-15 via BL-024) are both now addressed by `resolvesToPrivateAddress()` + `safeFetch()`'s manual per-hop revalidation.
- `pdf-parse`'s dynamic import (`await import('pdf-parse')`) is deliberate — see CONVENTIONS.md third-party library usage note. Do not hoist to a static top-level import.
