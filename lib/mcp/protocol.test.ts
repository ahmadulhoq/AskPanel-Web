import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleMessage, ERRORS, SUPPORTED_VERSIONS, type McpServer } from './protocol.ts'

const calls: unknown[] = []
const server: McpServer = {
  info: { name: 'askpanel', version: '1' },
  instructions: 'Use start_debate.',
  tools: [{ name: 'echo', title: 'Echo', description: 'd', inputSchema: { type: 'object' } }],
  callTool: async (name, args) => {
    calls.push([name, args])
    if (args.boom) throw new Error('boom')
    return { content: [{ type: 'text', text: `hi ${args.who}` }] }
  },
}
const modernMeta = { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }

test('legacy handshake: initialize negotiates a legacy version; notifications get no reply', async () => {
  const init = await handleMessage(server, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } })
  assert.deepEqual((init as { result: Record<string, unknown> }).result.protocolVersion, '2025-06-18')
  const newer = await handleMessage(server, { jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '2030-01-01' } })
  assert.equal((newer as { result: Record<string, unknown> }).result.protocolVersion, '2025-11-25')
  assert.equal(await handleMessage(server, { jsonrpc: '2.0', method: 'notifications/initialized' }), null)
  const list = await handleMessage(server, { jsonrpc: '2.0', id: 3, method: 'tools/list' }) as { result: Record<string, unknown> }
  assert.equal((list.result.tools as unknown[]).length, 1)
  assert.equal(list.result.resultType, undefined, 'legacy results stay legacy-shaped')
})

test('modern requests: discover, versioned results, unsupported version error', async () => {
  const discover = await handleMessage(server, { jsonrpc: '2.0', id: 'd', method: 'server/discover', params: modernMeta }) as { result: Record<string, unknown> }
  assert.deepEqual(discover.result.supportedVersions, SUPPORTED_VERSIONS)
  assert.equal(discover.result.resultType, 'complete')
  const list = await handleMessage(server, { jsonrpc: '2.0', id: 4, method: 'tools/list', params: modernMeta }) as { result: Record<string, unknown> }
  assert.equal(list.result.resultType, 'complete')
  assert.ok(list.result.ttlMs && list.result.cacheScope)
  const old = await handleMessage(server, { jsonrpc: '2.0', id: 5, method: 'tools/list', params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '1900-01-01' } } })
  assert.deepEqual(old, { jsonrpc: '2.0', id: 5, error: { code: ERRORS.unsupportedVersion, message: 'Unsupported protocol version', data: { supported: SUPPORTED_VERSIONS, requested: '1900-01-01' } } })
})

test('tools/call runs the tool; unknown tools and thrown errors are handled', async () => {
  const ok = await handleMessage(server, { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'echo', arguments: { who: 'there' } } }) as { result: Record<string, unknown> }
  assert.deepEqual(ok.result.content, [{ type: 'text', text: 'hi there' }])
  const unknown = await handleMessage(server, { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'nope' } }) as { error: { code: number } }
  assert.equal(unknown.error.code, ERRORS.invalidParams)
  const boom = await handleMessage(server, { jsonrpc: '2.0', id: 8, method: 'tools/call', params: { name: 'echo', arguments: { boom: true } } }) as { result: Record<string, unknown> }
  assert.equal(boom.result.isError, true)
})

test('malformed messages and unknown methods', async () => {
  assert.equal((await handleMessage(server, 'x') as { error: { code: number } }).error.code, ERRORS.invalidRequest)
  assert.equal((await handleMessage(server, { jsonrpc: '2.0', id: 9, method: 'nope' }) as { error: { code: number } }).error.code, ERRORS.methodNotFound)
  assert.equal(await handleMessage(server, { jsonrpc: '2.0', id: 10, result: {} }), null, 'client responses need no reply')
})
