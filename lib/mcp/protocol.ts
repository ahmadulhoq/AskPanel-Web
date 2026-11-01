// A small, stateless MCP server core (JSON-RPC 2.0), pure so it can be tested. It is
// "dual-era": modern clients (2026-07-28: version in each request's _meta, server/discover,
// resultType) and legacy clients (2025-11-25 and earlier: initialize handshake) both work.

export const MODERN_VERSIONS = ['2026-07-28']
export const LEGACY_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26']
export const SUPPORTED_VERSIONS = [...MODERN_VERSIONS, ...LEGACY_VERSIONS]

const META_VERSION = 'io.modelcontextprotocol/protocolVersion'
const META_SERVER_INFO = 'io.modelcontextprotocol/serverInfo'

export interface ToolDefinition {
  name: string
  title: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolResult {
  content: { type: 'text'; text: string }[]
  structuredContent?: Record<string, unknown>
  isError?: boolean
}

export interface McpServer {
  info: { name: string; version: string }
  instructions: string
  tools: ToolDefinition[]
  callTool: (name: string, args: Record<string, unknown>) => Promise<ToolResult>
}

type Id = string | number | null
export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: Id; result: Record<string, unknown> }
  | { jsonrpc: '2.0'; id: Id; error: { code: number; message: string; data?: unknown } }

export const ERRORS = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
  unsupportedVersion: -32022,
} as const

const fail = (id: Id, code: number, message: string, data?: unknown): JsonRpcResponse =>
  ({ jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } })

// Handles one JSON-RPC message. Returns null for notifications and responses (nothing to send).
export async function handleMessage(server: McpServer, message: unknown): Promise<JsonRpcResponse | null> {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return fail(null, ERRORS.invalidRequest, 'Invalid request')
  }
  const msg = message as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }
  const hasId = 'id' in msg && (typeof msg.id === 'string' || typeof msg.id === 'number')
  const id: Id = hasId ? (msg.id as string | number) : null
  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    // A JSON-RPC response from the client (we never send requests): nothing to do.
    if (msg.jsonrpc === '2.0' && hasId && !('method' in msg)) return null
    return fail(id, ERRORS.invalidRequest, 'Invalid request')
  }
  if (!hasId) return null // notification (e.g. notifications/initialized)

  const params = (msg.params && typeof msg.params === 'object' ? msg.params : {}) as Record<string, unknown>
  const meta = (params._meta && typeof params._meta === 'object' ? params._meta : {}) as Record<string, unknown>
  const requested = typeof meta[META_VERSION] === 'string' ? (meta[META_VERSION] as string) : null
  const modern = requested !== null
  if (modern && !SUPPORTED_VERSIONS.includes(requested)) {
    return fail(id, ERRORS.unsupportedVersion, 'Unsupported protocol version', { supported: SUPPORTED_VERSIONS, requested })
  }
  // Modern results say they are complete and who answered.
  const done = (result: Record<string, unknown>): JsonRpcResponse => ({
    jsonrpc: '2.0',
    id,
    result: modern ? { ...result, resultType: 'complete', _meta: { [META_SERVER_INFO]: server.info } } : result,
  })

  switch (msg.method) {
    case 'initialize': {
      const asked = typeof params.protocolVersion === 'string' ? params.protocolVersion : ''
      return done({
        protocolVersion: LEGACY_VERSIONS.includes(asked) ? asked : LEGACY_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: server.info,
        instructions: server.instructions,
      })
    }
    case 'server/discover':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          resultType: 'complete',
          supportedVersions: SUPPORTED_VERSIONS,
          capabilities: { tools: {} },
          instructions: server.instructions,
          _meta: { [META_SERVER_INFO]: server.info },
          ttlMs: 3_600_000,
          cacheScope: 'public',
        },
      }
    case 'ping':
      return done({})
    case 'tools/list':
      return done({ tools: server.tools, ...(modern ? { ttlMs: 3_600_000, cacheScope: 'public' } : {}) })
    case 'tools/call': {
      const name = typeof params.name === 'string' ? params.name : ''
      if (!server.tools.some((t) => t.name === name)) return fail(id, ERRORS.invalidParams, `Unknown tool: ${name || '(none)'}`)
      const args = (params.arguments && typeof params.arguments === 'object' ? params.arguments : {}) as Record<string, unknown>
      try {
        return done({ ...(await server.callTool(name, args)) })
      } catch (err) {
        console.error('[mcp] tool failed', name, err)
        return done({ content: [{ type: 'text', text: 'Something went wrong on our side. Try again.' }], isError: true })
      }
    }
    default:
      return fail(id, ERRORS.methodNotFound, `Method not found: ${msg.method}`)
  }
}
