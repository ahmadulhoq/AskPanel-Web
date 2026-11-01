// Local stand-in for the Anthropic Messages API, so the e2e suite never calls the real
// service. Respondent/Critic/reply calls stream markdown; the Synthesizer and Judge get a
// tool_use; non-streaming calls (titles, summaries) get a short text. It also enforces the
// real API's request rules (forced tool_choice, strict schemas, thinking) — see below.
//
// Control endpoints for tests: POST /__control {tokenDelayMs, synthDelayMs, failRole, decision,
// textFirst, starveRole}, GET /__stats (calls per role), POST /__reset.
//   textFirst: the Synthesizer/Judge answer a first request in text instead of the tool (a
//     retry that carries that turn on gets the tool call).
//   starveRole: that role's thinking uses up the cap — streamed turns end with no text, tool
//     calls are cut off mid-input (stop_reason max_tokens).
import http from 'node:http'

const PORT = Number(process.env.FAKE_ANTHROPIC_PORT ?? 8099)
const DEFAULTS = { tokenDelayMs: 40, synthDelayMs: 0, failRole: null, decision: 'consensus', textFirst: false, starveRole: null }
const ctl = { ...DEFAULTS }
const calls = { respondent: 0, critic: 0, synthesizer: 0, title: 0, reply: 0, summary: 0, proposer: 0, judge: 0, convene: 0 }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const FINAL_ANSWER = '## Verdict\n\nRaise a **small** round.\n\n1. Cut burn first\n2. Then raise'

// Roles are told apart by the built-in system prompts; custom-persona runs would be
// counted as 'title', so scenarios use built-in personas.
const roleOf = (body) => {
  if (body.tools?.[0]?.name === 'judge_options') return 'judge'
  if (body.tools?.[0]?.name === 'evaluate_debate') return 'synthesizer'
  const system = (body.system ?? []).map((s) => s.text ?? '').join(' ')
  if (/Critic in a/.test(system)) return 'critic'
  if (/Respondent in a/.test(system)) return 'respondent'
  if (/Proposer in a/.test(system)) return 'proposer'
  if (/running summary/.test(system)) return 'summary'
  if (/AskPanel's assistant/.test(system)) return 'reply'
  return 'title'
}

// Request rules of the real API that a fake would otherwise hide (from the Claude Sonnet 5.5
// and Haiku 5.5 migration guides). A broken request gets the same 400 the API would send.
const NO_FORCED_TOOLS = new Set(['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1'])
const UNSUPPORTED_STRICT = ['minimum', 'maximum', 'multipleOf', 'minLength', 'maxLength', 'maxItems']
function strictProblem(schema, path = 'input_schema') {
  if (!schema || typeof schema !== 'object') return null
  for (const k of UNSUPPORTED_STRICT) if (k in schema) return `${path}: "${k}" is not supported with strict`
  if (schema.type === 'object' && schema.additionalProperties !== false) return `${path}: objects need additionalProperties: false with strict`
  for (const [k, v] of Object.entries(schema.properties ?? {})) { const p = strictProblem(v, `${path}.${k}`); if (p) return p }
  return schema.items ? strictProblem(schema.items, `${path}[]`) : null
}
function requestProblem(body) {
  const choice = body.tool_choice?.type
  if (NO_FORCED_TOOLS.has(body.model) && (choice === 'any' || choice === 'tool')) {
    return 'tool_choice: type "tool" and "any" are not supported for this model.'
  }
  if (body.model === 'claude-sonnet-5-5' && body.thinking?.type === 'disabled') {
    return 'To turn thinking off on this model, send "thinking": {"type": "between_tools"} instead of {"type": "disabled"}.'
  }
  for (const tool of body.tools ?? []) {
    if (tool.strict) { const p = strictProblem(tool.input_schema); if (p) return `tools.${tool.name}.${p}` }
  }
  return null
}
// Thinking runs unless turned off, and counts toward max_tokens.
const thinks = (body) => !['disabled', 'between_tools'].includes(body.thinking?.type)
const THINKING_TOKENS = 1024

const server = http.createServer(async (req, res) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  let body
  try {
    body = JSON.parse(raw || '{}')
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'body is not JSON' } }))
  }
  if (req.url === '/__control') { Object.assign(ctl, body); return res.end('{}') }
  if (req.url === '/__stats') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(calls)) }
  if (req.url === '/__reset') { for (const k in calls) calls[k] = 0; Object.assign(ctl, DEFAULTS); return res.end('{}') }

  const problem = requestProblem(body)
  if (problem) {
    res.writeHead(400, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: problem } }))
  }
  const role = roleOf(body)
  // A cap too small for the thinking that runs first: the model stops before answering.
  const tooSmall = (body.max_tokens ?? 0) < THINKING_TOKENS
  const starved = thinks(body) && (tooSmall || ctl.starveRole === role)
  const thinkingBlock = { type: 'thinking', thinking: '', signature: 'fake-signature' }
  const msg = { id: 'msg_' + Date.now(), type: 'message', role: 'assistant', model: body.model, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 5 } }
  const json = (stopReason, content) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ ...msg, stop_reason: stopReason, content }))
  }
  // Streams the message start and, when thinking is on, the thinking block that comes
  // first. Returns the next block's index, or null if the cap ran out while thinking (the
  // response is then complete).
  let ev
  const startStream = () => {
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
    ev('message_start', { message: { ...msg, content: [], stop_reason: null } })
    if (!thinks(body)) return 0
    ev('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } })
    ev('content_block_delta', { index: 0, delta: { type: 'signature_delta', signature: 'fake-signature' } })
    ev('content_block_stop', { index: 0 })
    if (!starved) return 1
    endStream('max_tokens')
    return null
  }
  const endStream = (stopReason) => {
    ev('message_delta', { delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 25 } })
    ev('message_stop', {})
    res.end()
  }

  // The coordinator: messages that start with "Should" go to the panel.
  const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')
  const lastText = typeof lastUser?.content === 'string' ? lastUser.content.split('\n\n').at(-1) : ''
  if (role === 'reply' && body.tools?.some((t) => t.name === 'convene_panel') && /^Should/.test(lastText)) {
    calls.convene++
    const input = JSON.stringify({ mode: /\bor\b/.test(lastText) ? 'compare' : 'critique', question: `${lastText} (restated with context)`, reason: 'This is a trade-off worth stress-testing.' })
    const at = startStream()
    if (at === null) return
    ev('content_block_start', { index: at, content_block: { type: 'tool_use', id: 'toolu_c', name: 'convene_panel', input: {} } })
    for (const part of input.match(/.{1,12}/gs)) ev('content_block_delta', { index: at, delta: { type: 'input_json_delta', partial_json: part } })
    ev('content_block_stop', { index: at })
    return endStream('tool_use')
  }
  calls[role]++
  if (ctl.failRole === role) {
    res.writeHead(500, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: `forced ${role} failure` } }))
  }
  const lead = thinks(body) ? [thinkingBlock] : []

  if (role === 'judge' || role === 'synthesizer') {
    if (role === 'synthesizer') await sleep(ctl.synthDelayMs)
    const name = body.tools[0].name
    // Out of room: no tool call at all, or one cut off before its input was complete.
    if (starved) return json('max_tokens', tooSmall ? [thinkingBlock] : [thinkingBlock, { type: 'tool_use', id: 'toolu_x', name, input: {} }])
    if (ctl.textFirst && body.messages.length === 1) {
      return json('end_turn', [...lead, { type: 'text', text: 'My verdict, in prose instead of the tool.' }])
    }
    const input = role === 'judge'
      ? {
        winner: 2, confidence: 'high', reasoning: 'Plan B balances runway and growth.',
        scores: [1, 2, 3].map((option) => ({ option, score: option === 2 ? 8 : 5, summary: `Score for option ${option}.` })),
        finalAnswer: '## Go with Plan B\n\nIt wins on runway. Plan A lost on risk; Plan C lost on speed.',
      }
      : { decision: ctl.decision, confidence: 'high', reasoning: 'Both agents agree.', issuesFound: 1, finalAnswer: FINAL_ANSWER }
    return json('tool_use', [...lead, { type: 'tool_use', id: 'toolu_1', name, input }])
  }
  if (!body.stream) {
    if (starved) return json('max_tokens', [thinkingBlock])
    const text = role === 'summary' ? 'They are planning a product launch next month.' : 'Harness Panel Title'
    return json('end_turn', [...lead, { type: 'text', text }])
  }

  const at = startStream()
  if (at === null) return
  ev('content_block_start', { index: at, content_block: { type: 'text', text: '' } })
  // Markdown split into small tokens, so rendering of partial markdown is exercised.
  const heading = role === 'proposer' ? `### Plan ${'ABCDEFGH'[(calls.proposer - 1) % 8]}\n\n` : ''
  const md = `${heading}## ${role} view\n\nHere is the **key point** for this ${role} turn.\n\n- First consideration with detail\n- Second consideration\n- Third one\n\n| Option | Cost |\n|---|---|\n| A | Low |\n| B | High |\n\nClosing sentence from the ${role}.`
  for (const token of md.match(/.{1,6}/gs)) {
    ev('content_block_delta', { index: at, delta: { type: 'text_delta', text: token } })
    await sleep(ctl.tokenDelayMs)
  }
  ev('content_block_stop', { index: at })
  endStream('end_turn')
})

server.listen(PORT, '127.0.0.1', () => console.log(`fake Anthropic API on 127.0.0.1:${PORT}`))
