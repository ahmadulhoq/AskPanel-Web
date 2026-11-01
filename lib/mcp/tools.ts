import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { PERSONAS } from '@/lib/agents/personas'
import { createPanel, MAX_CONTEXT_CHARS } from '@/lib/panels/create'
import { FreeLimitReachedError, ProLimitReachedError, PRO_RUN_LIMIT, resetDateLabel } from '@/lib/billing/runs'
import { RateLimitedError } from '@/lib/limits/rateLimit'
import { sanitizeDebateSettings } from '@/lib/conversations/settings'
import { titleConversation } from '@/lib/conversations/title'
import { messagesRef } from '@/lib/conversations/store'
import { runPanelJob } from '@/lib/agents/runner'
import { stopIfRunning } from '@/lib/panels/delete'
import type { McpServer, ToolResult } from './protocol'
import type { DocumentReference } from 'firebase-admin/firestore'
import type { PanelDoc } from '@/types'

// MCP tools (spec §11): debates are long, so the API is asynchronous — start one, then
// fetch the result (optionally waiting a bounded time for it).

const APP_URL = () => process.env.NEXT_PUBLIC_APP_URL ?? 'https://askpanel.app'
const MAX_WAIT_SECONDS = 25

const text = (t: string, structured?: Record<string, unknown>, isError = false): ToolResult => ({
  content: [{ type: 'text', text: t }],
  ...(structured ? { structuredContent: structured } : {}),
  ...(isError ? { isError: true } : {}),
})

// `signal`: the HTTP request's, so a waiting call stops when the client goes away.
export function askPanelServer(uid: string, signal?: AbortSignal): McpServer {
  return {
    info: { name: 'askpanel', version: '1.0.0' },
    instructions:
      'AskPanel stress-tests decisions with a debate between AI agents. Use start_debate for a decision, plan or trade-off ' +
      '(mode "compare" to choose between alternatives), then call get_debate_result with the debate_id until it is complete. ' +
      'Debates take one to three minutes. Each debate counts against the user\'s AskPanel plan.',
    tools: [
      {
        name: 'start_debate',
        title: 'Start a debate',
        description:
          'Start an AskPanel debate on a decision, plan or trade-off. "critique": a Respondent answers, a Critic stress-tests it, a ' +
          'Synthesizer gives a verdict with a confidence level. "compare": three options compete and a Judge picks the winner. ' +
          'Returns a debate_id immediately; call get_debate_result to get the verdict.',
        inputSchema: {
          type: 'object',
          properties: {
            question: { type: 'string', minLength: 10, maxLength: 4000, description: 'The decision or question, self-contained, with the relevant facts and constraints.' },
            mode: { type: 'string', enum: ['critique', 'compare'], description: 'Default "critique". Use "compare" to choose between alternatives.' },
            persona: { type: 'string', enum: PERSONAS.map((p) => p.key), description: 'The panel\'s lens (some need AskPanel Pro). Default "general".' },
            rounds: { type: 'integer', minimum: 1, maximum: 3, description: 'Critique mode: maximum debate rounds (3 needs Pro). Default 2.' },
            context: { type: 'string', maxLength: MAX_CONTEXT_CHARS, description: 'Optional background the panel should consider (documents, notes).' },
          },
          required: ['question'],
        },
      },
      {
        name: 'get_debate_result',
        title: 'Get a debate result',
        description:
          'Get the status of a debate started with start_debate, and its verdict once complete. Waits up to wait_seconds for it ' +
          'to finish; call again while the status is "running".',
        inputSchema: {
          type: 'object',
          properties: {
            debate_id: { type: 'string', description: 'The debate_id returned by start_debate.' },
            wait_seconds: { type: 'integer', minimum: 0, maximum: MAX_WAIT_SECONDS, description: `How long to wait for completion (default 20, max ${MAX_WAIT_SECONDS}).` },
          },
          required: ['debate_id'],
        },
      },
    ],
    callTool: (name, args) => (name === 'start_debate' ? startDebate(uid, args) : getDebateResult(uid, args, signal)),
  }
}

async function startDebate(uid: string, args: Record<string, unknown>): Promise<ToolResult> {
  const question = typeof args.question === 'string' ? args.question.trim() : ''
  if (question.length < 10 || question.length > 4000) return text('The question must be 10–4000 characters.', undefined, true)
  const settings = sanitizeDebateSettings({ persona: args.persona, maxRounds: args.rounds, mode: args.mode })
  const context = typeof args.context === 'string' && args.context.trim() ? args.context.trim().slice(0, MAX_CONTEXT_CHARS) : null

  // The debate lives in a conversation of its own, so the user finds it on their dashboard.
  // The conversation and question are written first: if the debate then can't start, they
  // are removed; once it has started, nothing can leave it without a conversation.
  const conversation = adminDb().collection('conversations').doc()
  const userRef = messagesRef(conversation.id).doc()
  const assistantRef = messagesRef(conversation.id).doc()
  const seq = Date.now()
  const opening = adminDb().batch()
  opening.create(conversation, {
    userId: uid, title: null, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    debateCount: 1, source: 'mcp',
  })
  opening.create(userRef, {
    role: 'user', kind: 'text', content: question, panelId: null, status: 'complete', seq, createdAt: FieldValue.serverTimestamp(),
    ...(context ? { context } : {}),
  })
  await opening.commit()

  let panelId: string
  try {
    panelId = await createPanel({
      uid,
      question,
      isPublic: false,
      persona: settings.persona,
      maxRounds: settings.maxRounds,
      mode: settings.mode,
      userContext: context,
      conversationId: conversation.id,
      messageId: assistantRef.id,
    })
  } catch (err) {
    await adminDb().recursiveDelete(conversation).catch(() => {})
    if (err instanceof ProLimitReachedError) {
      return text(`The user has used their ${PRO_RUN_LIMIT} AskPanel debates for this month. More from ${resetDateLabel(err.resetAt)}.`, undefined, true)
    }
    if (err instanceof FreeLimitReachedError) {
      return text(`The user has used their free AskPanel debates for this month. They can upgrade at ${APP_URL()}/account.`, undefined, true)
    }
    if (err instanceof RateLimitedError) return text(`Too many debates started. Try again in ${err.retryAfterSeconds} seconds.`, undefined, true)
    throw err
  }

  try {
    await assistantRef.create({
      role: 'assistant', kind: 'debate', content: '', panelId, status: 'complete', seq: seq + 1, createdAt: FieldValue.serverTimestamp(),
    })
  } catch (err) {
    // The debate couldn't be attached to its conversation: stop it (refunded) rather than
    // leave a charged debate the user can't find.
    await stopIfRunning(panelId, uid).catch(() => {})
    throw err
  }
  void titleConversation(conversation.id, question)

  const url = `${APP_URL()}/chat/${conversation.id}`
  return text(
    `Debate started (debate_id: ${panelId}, mode: ${settings.mode}). It takes one to three minutes — call get_debate_result ` +
      `with this debate_id for the verdict. The user can watch it live at ${url}`,
    { debate_id: panelId, status: 'queued', mode: settings.mode, url },
  )
}

const TERMINAL = new Set(['complete', 'error'])

// Resolves with the panel once it is complete or failed, or at the deadline, or when the
// client goes away — watching the doc rather than polling it.
function waitForPanel(ref: DocumentReference, ms: number, signal?: AbortSignal): Promise<PanelDoc | undefined> {
  return new Promise((resolve) => {
    let latest: PanelDoc | undefined
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      unsubscribe()
      signal?.removeEventListener('abort', finish)
      resolve(latest)
    }
    const timer = setTimeout(finish, ms)
    signal?.addEventListener('abort', finish)
    const unsubscribe = ref.onSnapshot(
      (snap) => {
        latest = snap.data() as PanelDoc | undefined
        if (!latest || TERMINAL.has(latest.status)) finish()
      },
      () => finish(),
    )
  })
}

async function getDebateResult(uid: string, args: Record<string, unknown>, signal?: AbortSignal): Promise<ToolResult> {
  const id = typeof args.debate_id === 'string' ? args.debate_id.trim() : ''
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return text('Unknown debate_id.', undefined, true)
  const waitMs = Math.min(Math.max(Number(args.wait_seconds ?? 20) || 0, 0), MAX_WAIT_SECONDS) * 1000
  const ref = adminDb().collection('panels').doc(id)

  let panel = (await ref.get()).data() as PanelDoc | undefined
  if (!panel || panel.userId !== uid) return text('Unknown debate_id.', undefined, true)
  if (!TERMINAL.has(panel.status)) {
    // Like a viewer opening the debate: resumes it if its runner died (no-op otherwise).
    runPanelJob(id).catch((err) => console.error('[mcp] runner crashed', id, err))
    if (waitMs > 0) panel = await waitForPanel(ref, waitMs, signal)
  }
  if (!panel) return text('This debate was deleted.', { debate_id: id, status: 'deleted' }, true)

  const url = panel.conversationId ? `${APP_URL()}/chat/${panel.conversationId}` : `${APP_URL()}/panel/${id}`
  const transcript = `${APP_URL()}/panel/${id}`
  if (panel.status === 'complete') {
    const judgement = panel.mode === 'compare' ? panel.compare?.judgement ?? null : null
    const structured = {
      debate_id: id, status: 'complete', mode: panel.mode ?? 'critique', confidence: panel.confidence,
      final_answer: panel.finalAnswer ?? '', url, transcript_url: transcript,
      ...(judgement ? { winner: judgement.winner, scores: judgement.scores } : {}),
    }
    const head = judgement ? `Winner: option ${judgement.winner}. ` : ''
    return text(`${head}Confidence: ${panel.confidence}.\n\n${panel.finalAnswer ?? ''}\n\nFull debate: ${transcript}`, structured)
  }
  if (panel.status === 'error') {
    return text(`The debate did not finish: ${panel.errorMessage ?? 'it failed'}. See ${url}`, { debate_id: id, status: 'error', error: panel.errorMessage, url }, true)
  }
  const step = panel.live ? `${panel.live.agent}${panel.live.index !== undefined ? ` ${panel.live.index + 1}` : ''}, round ${panel.live.round}` : 'starting'
  return text(
    `Still deliberating (${step}). Call get_debate_result again in a little while.`,
    { debate_id: id, status: panel.status === 'queued' ? 'queued' : 'running', step, url },
  )
}
