// Local stand-in for the Anthropic Messages API, so the e2e suite never calls the real
// service. Respondent/Critic/reply calls stream markdown; the Synthesizer and Judge get a
// tool_use; non-streaming calls (titles, summaries) get a short text. It also enforces the
// real API's request rules (forced tool_choice, strict schemas, thinking) — see below.
//
// Control endpoints for tests: POST /__control {tokenDelayMs, synthDelayMs, failRole, decision},
// GET /__stats (calls per role), POST /__reset.
import http from 'node:http'

const PORT = Number(process.env.FAKE_ANTHROPIC_PORT ?? 8099)
const DEFAULTS = { tokenDelayMs: 40, synthDelayMs: 0, failRole: null, decision: 'consensus' }
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
  const starved = thinks(body) && (body.max_tokens ?? 0) < THINKING_TOKENS
  const thinkingBlock = { type: 'thinking', thinking: '', signature: 'fake-signature' }
  // The coordinator: messages that start with "Should" go to the panel.
  const lastUser = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user')
  const lastText = typeof lastUser?.content === 'string' ? lastUser.content.split('\n\n').at(-1) : ''
  if (role === 'reply' && body.tools?.some((t) => t.name === 'convene_panel') && /^Should/.test(lastText)) {
    calls.convene++
    const input = JSON.stringify({ mode: /\bor\b/.test(lastText) ? 'compare' : 'critique', question: `${lastText} (restated with context)`, reason: 'This is a trade-off worth stress-testing.' })
    res.writeHead(200, { 'content-type': 'text/event-stream' })
    const send = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
    send('message_start', { message: { id: 'msg_c', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 1 } } })
    send('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } })
    send('content_block_delta', { index: 0, delta: { type: 'signature_delta', signature: 'fake-signature' } })
    send('content_block_stop', { index: 0 })
    send('content_block_start', { index: 1, content_block: { type: 'tool_use', id: 'toolu_c', name: 'convene_panel', input: {} } })
    for (const part of input.match(/.{1,12}/gs)) send('content_block_delta', { index: 1, delta: { type: 'input_json_delta', partial_json: part } })
    send('content_block_stop', { index: 1 })
    send('message_delta', { delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 20 } })
    send('message_stop', {})
    return res.end()
  }
  calls[role]++
  if (ctl.failRole === role) {
    res.writeHead(500, { 'content-type': 'application/json' })
    return res.end(JSON.stringify({ type: 'error', error: { type: 'api_error', message: `forced ${role} failure` } }))
  }
  const msg = { id: 'msg_' + Date.now(), type: 'message', role: 'assistant', model: body.model, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 5 } }
  if (starved && !body.stream) {
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({ ...msg, stop_reason: 'max_tokens', content: [thinkingBlock] }))
  }
  const lead = thinks(body) ? [thinkingBlock] : []

  if (role === 'judge') {
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({
      ...msg, stop_reason: 'tool_use',
      content: [...lead, { type: 'tool_use', id: 'toolu_2', name: 'judge_options', input: {
        winner: 2, confidence: 'high', reasoning: 'Plan B balances runway and growth.',
        scores: [1, 2, 3].map((option) => ({ option, score: option === 2 ? 8 : 5, summary: `Score for option ${option}.` })),
        finalAnswer: '## Go with Plan B\n\nIt wins on runway. Plan A lost on risk; Plan C lost on speed.',
      } }],
    }))
  }
  if (role === 'synthesizer') {
    await sleep(ctl.synthDelayMs)
    res.setHeader('content-type', 'application/json')
    return res.end(JSON.stringify({
      ...msg, stop_reason: 'tool_use',
      content: [...lead, { type: 'tool_use', id: 'toolu_1', name: body.tools[0].name, input: { decision: ctl.decision, confidence: 'high', reasoning: 'Both agents agree.', issuesFound: 1, finalAnswer: FINAL_ANSWER } }],
    }))
  }
  if (!body.stream) {
    res.setHeader('content-type', 'application/json')
    const text = role === 'summary' ? 'They are planning a product launch next month.' : 'Harness Panel Title'
    return res.end(JSON.stringify({ ...msg, stop_reason: 'end_turn', content: [...lead, { type: 'text', text }] }))
  }

  res.writeHead(200, { 'content-type': 'text/event-stream' })
  const ev = (type, data) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
  ev('message_start', { message: { ...msg, content: [], stop_reason: null } })
  let at = 0
  if (thinks(body)) {
    ev('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '', signature: '' } })
    ev('content_block_delta', { index: 0, delta: { type: 'signature_delta', signature: 'fake-signature' } })
    ev('content_block_stop', { index: 0 })
    at = 1
    if (starved) {
      ev('message_delta', { delta: { stop_reason: 'max_tokens', stop_sequence: null }, usage: { output_tokens: body.max_tokens } })
      ev('message_stop', {})
      return res.end()
    }
  }
  ev('content_block_start', { index: at, content_block: { type: 'text', text: '' } })
  // Markdown split into small tokens, so rendering of partial markdown is exercised.
  const heading = role === 'proposer' ? `### Plan ${'ABCDEFGH'[(calls.proposer - 1) % 8]}\n\n` : ''
  const md = `${heading}## ${role} view\n\nHere is the **key point** for this ${role} turn.\n\n- First consideration with detail\n- Second consideration\n- Third one\n\n| Option | Cost |\n|---|---|\n| A | Low |\n| B | High |\n\nClosing sentence from the ${role}.`
  for (const token of md.match(/.{1,6}/gs)) {
    ev('content_block_delta', { index: at, delta: { type: 'text_delta', text: token } })
    await sleep(ctl.tokenDelayMs)
  }
  ev('content_block_stop', { index: at })
  ev('message_delta', { delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 25 } })
  ev('message_stop', {})
  res.end()
})

server.listen(PORT, '127.0.0.1', () => console.log(`fake Anthropic API on 127.0.0.1:${PORT}`))
