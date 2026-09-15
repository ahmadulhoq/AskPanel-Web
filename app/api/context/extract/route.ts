import { NextResponse, type NextRequest } from 'next/server'
import { lookup } from 'node:dns/promises'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'

const MAX_CONTEXT_CHARS = 4000
const MAX_REDIRECTS = 3
const FETCH_TIMEOUT_MS = 10_000

// Prevent SSRF by blocking private/loopback/link-local/reserved addresses.
function isPrivateIp(address: string): boolean {
  const h = address.toLowerCase()
  if (h === '127.0.0.1' || h === '::1' || h === '::') return true
  if (h === '169.254.169.254') return true // GCP/AWS metadata
  // IPv6 unique local (fc00::/7) and link-local (fe80::/10)
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) {
    if (h.includes(':')) return true
  }
  const ipv4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 127) return true
    if (a === 0) return true
  }
  return false
}

function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost') return true
  return isPrivateIp(h)
}

// Resolves the hostname and checks every returned address — closes the DNS-rebinding
// gap where a public hostname resolves to a private/internal IP.
async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
  if (isPrivateHost(hostname)) return true
  try {
    const addresses = await lookup(hostname, { all: true })
    return addresses.some(addr => isPrivateIp(addr.address))
  } catch {
    // Unresolvable host — treat as unsafe rather than silently allowing the fetch to fail later.
    return true
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, ' ')
    .trim()
}

class SSRFError extends Error {}

// Follows redirects manually (fetch's automatic redirect-following would bypass our
// hostname/IP validation on each hop) — each hop is re-validated before following.
async function safeFetch(startUrl: URL): Promise<Response> {
  let current = startUrl
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (current.protocol !== 'http:' && current.protocol !== 'https:') {
      throw new SSRFError('Only http and https URLs are supported')
    }
    if (await resolvesToPrivateAddress(current.hostname)) {
      throw new SSRFError('URL points to a private or reserved address')
    }

    const response = await fetch(current.toString(), {
      headers: { 'User-Agent': 'AskPanel/1.0 (+https://askpanel.app)' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: 'manual',
    })

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) return response
      current = new URL(location, current)
      continue
    }

    return response
  }
  throw new SSRFError('Too many redirects')
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = adminDb()
  const userSnap = await db.collection('users').doc(user.uid).get()
  const tier = userSnap.data()?.subscription?.tier ?? 'free'
  if (tier !== 'pro') {
    return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 })
  }

  const body = await request.json()
  const { url } = body

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only http and https URLs are supported' }, { status: 400 })
  }

  try {
    const response = await safeFetch(parsed)

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: HTTP ${response.status}` }, { status: 422 })
    }

    const contentType = response.headers.get('content-type') ?? ''
    let text: string

    if (contentType.includes('text/html')) {
      const html = await response.text()
      text = stripHtml(html)
    } else if (contentType.includes('text/')) {
      text = await response.text()
    } else {
      return NextResponse.json({ error: 'URL must point to an HTML or plain-text page' }, { status: 422 })
    }

    if (text.length > MAX_CONTEXT_CHARS) {
      text = text.slice(0, MAX_CONTEXT_CHARS) + '…'
    }

    return NextResponse.json({ text })
  } catch (err) {
    if (err instanceof SSRFError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    const message = err instanceof Error ? err.message : 'Failed to fetch URL'
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
