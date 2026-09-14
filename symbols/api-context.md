# Module: app/api/context

**Responsibility:** Pro-only context extraction for panel questions — URL fetch and file upload, both normalized to plain text capped at 4000 chars.

## Route Handlers

| Route | File | Responsibility |
|---|---|---|
| `POST /api/context/extract` | extract/route.ts | Pro-gated. Validates URL is well-formed and `http:`/`https:` only. Blocks private/loopback/link-local/cloud-metadata hosts via `isPrivateHost()` (SSRF protection). Fetches with a 10s timeout and a custom User-Agent. Strips HTML via `stripHtml()` if `content-type` is `text/html`, otherwise accepts any `text/*`. Truncates to 4000 chars. |
| `POST /api/context/upload` | upload/route.ts | Pro-gated. Accepts multipart form data, field name `file`. 5 MB size cap. Accepts `.txt`/`.md` (read directly as text) and `.pdf` (parsed via `pdf-parse`'s `PDFParse` class, dynamically imported). Truncates to 4000 chars. |

## Internal Helpers

| Name | File | Responsibility |
|---|---|---|
| `isPrivateHost(hostname)` | extract/route.ts | SSRF guard — blocks `localhost`, `127.0.0.1`, `::1`, `169.254.169.254` (cloud metadata), and RFC1918 private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), plus 169.254.0.0/16 link-local and 0.0.0.0/8 |
| `stripHtml(html)` | extract/route.ts | Removes `<script>`/`<style>` blocks, strips remaining tags, decodes common HTML entities, collapses whitespace |

## Notes / Findings
- No FIXME/TODO/HACK comments found.
- `isPrivateHost()` only checks the literal hostname string — it does NOT resolve DNS before checking (i.e. a hostname like `evil.example.com` that resolves to `127.0.0.1` via DNS would pass this check and only fail/succeed based on what `fetch()` itself connects to). This is a DNS-rebinding-style gap. **Flagged as TECH_DEBT** (see TECH_DEBT.md) rather than SACRED — this looks like an incomplete implementation, not an intentional tradeoff, and the fix (resolve hostname first, check resolved IP, or use a fetch wrapper that validates the connected IP) is well-understood. Severity: low-medium — requires an attacker to control DNS for a domain they get a Pro user to paste, and even then the blast radius is limited to text extraction of the fetched page (not stored credentials), but still worth closing.
- `pdf-parse`'s dynamic import (`await import('pdf-parse')`) is deliberate — see CONVENTIONS.md third-party library usage note. Do not hoist to a static top-level import.
