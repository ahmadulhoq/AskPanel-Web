import { NextResponse, type NextRequest } from 'next/server'
import { limitResponse } from '@/lib/limits/rateLimit'
import { handleMessage, ERRORS, type JsonRpcResponse } from '@/lib/mcp/protocol'
import { bearerToken } from '@/lib/mcp/tokenFormat'
import { verifyApiToken } from '@/lib/mcp/tokens'
import { askPanelServer } from '@/lib/mcp/tools'

// The AskPanel MCP server (spec §11), Streamable HTTP, stateless: every POST carries one
// JSON-RPC message (or a batch, for older clients) and gets a JSON answer. Authenticated
// with a personal API token from the Account page: "Authorization: Bearer ap_…".
export async function POST(request: NextRequest) {
  const token = bearerToken(request.headers.get('authorization'))
  const uid = token ? await verifyApiToken(token) : null
  if (!uid) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Missing or invalid API token. Create one on your AskPanel Account page.' } },
      { status: 401, headers: { 'WWW-Authenticate': 'Bearer realm="askpanel"' } },
    )
  }
  const limited = await limitResponse('mcp', uid)
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ jsonrpc: '2.0', id: null, error: { code: ERRORS.parse, message: 'Parse error' } }, { status: 400 })
  }

  const server = askPanelServer(uid)
  const messages = Array.isArray(body) ? body.slice(0, 20) : [body]
  const replies = (await Promise.all(messages.map((m) => handleMessage(server, m)))).filter((r): r is JsonRpcResponse => r !== null)
  // Only notifications or responses: accepted, nothing to say.
  if (replies.length === 0) return new Response(null, { status: 202 })
  return NextResponse.json(Array.isArray(body) ? replies : replies[0])
}

// No server-initiated stream: this server never sends requests or notifications.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } })
}

export function DELETE() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } })
}
