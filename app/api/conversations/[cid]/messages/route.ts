import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { createPanel } from '@/lib/panels/create'
import { FreeLimitReachedError } from '@/lib/billing/runs'
import { limitInTransaction, RateLimitedError, rateLimitedResponse } from '@/lib/limits/rateLimit'
import { reserveReply, ReplyLimitReachedError, FREE_DAILY_REPLIES } from '@/lib/billing/replies'
import {
  toModelMessages, debateContext, replyHistory, REPLY_BUDGET_CHARS, REPLY_LOAD_MESSAGES, REPLY_SLACK_CHARS,
} from '@/lib/conversations/context'
import { streamReply } from '@/lib/conversations/reply'
import { titleConversation } from '@/lib/conversations/title'
import { updateSummary } from '@/lib/conversations/summary'
import { sanitizeDebateSettings } from '@/lib/conversations/settings'
import {
  conversationRef, getOwnedConversation, loadMessages, messagesRef, nextSeq, toMessageView,
} from '@/lib/conversations/store'
import type { NewMessage } from '@/lib/conversations/store'
import type { ReplyStreamEvent } from '@/types'

const MAX_MESSAGE_CHARS = 4000
const MIN_DEBATE_CHARS = 10

export async function POST(request: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const conversation = await getOwnedConversation(cid, user.uid)
  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json().catch(() => ({}))
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const mode = body.mode === 'debate' ? 'debate' : 'reply'
  // Remembered on the conversation so the composer reopens with the same panel.
  const debateSettings = sanitizeDebateSettings(body.settings)
  const settingsUpdate = body.settings ? { debateSettings } : {}
  if (!content || content.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: `Messages must be 1–${MAX_MESSAGE_CHARS} characters.` }, { status: 400 })
  }
  if (mode === 'debate' && content.length < MIN_DEBATE_CHARS) {
    return NextResponse.json({ error: 'Give the panel a bit more to debate (at least 10 characters).' }, { status: 400 })
  }

  const history = await loadMessages(cid, REPLY_LOAD_MESSAGES)
  // Messages already folded into the rolling summary are sent as the summary instead.
  const summary = conversation.summary ?? null
  const summarizedThroughSeq = conversation.summarizedThroughSeq ?? 0
  const unsummarized = replyHistory(history, summarizedThroughSeq)
  const seq = nextSeq(history)
  const userRef = messagesRef(cid).doc()
  const assistantRef = messagesRef(cid).doc()
  const userMessage: NewMessage = { role: 'user', kind: 'text', content, panelId: null, status: 'complete', seq }
  const created = { createdAt: FieldValue.serverTimestamp() }
  const isFirstMessage = history.length === 0 && !conversation.title

  if (mode === 'debate') {
    let panelId: string
    try {
      panelId = await createPanel({
        uid: user.uid,
        question: content,
        isPublic: false,
        persona: debateSettings.persona,
        maxRounds: debateSettings.maxRounds,
        mode: debateSettings.mode,
        userContext: debateContext(unsummarized, undefined, summary),
        conversationId: cid,
        messageId: assistantRef.id,
      })
    } catch (err) {
      if (err instanceof FreeLimitReachedError) {
        return NextResponse.json({ error: 'FREE_LIMIT_REACHED' }, { status: 402 })
      }
      if (err instanceof RateLimitedError) return rateLimitedResponse(err)
      throw err
    }
    const assistantMessage: NewMessage = { ...userMessage, role: 'assistant', kind: 'debate', content: '', panelId, seq: seq + 1 }
    const batch = adminDb().batch()
    batch.set(userRef, { ...userMessage, ...created })
    batch.set(assistantRef, { ...assistantMessage, ...created })
    batch.update(conversationRef(cid), { updatedAt: FieldValue.serverTimestamp(), ...settingsUpdate })
    await batch.commit()
    if (isFirstMessage) titleConversation(cid, content)

    return NextResponse.json({
      messages: [
        toMessageView(userRef.id, userMessage),
        toMessageView(assistantRef.id, assistantMessage, { status: 'queued', finalAnswer: null, confidence: null }),
      ],
    })
  }

  try {
    await adminDb().runTransaction(async (tx) => {
      const countReply = await limitInTransaction(tx, 'reply', user.uid)
      await reserveReply(tx, adminDb().collection('users').doc(user.uid), Date.now())
      countReply()
    })
  } catch (err) {
    if (err instanceof RateLimitedError) return rateLimitedResponse(err)
    if (err instanceof ReplyLimitReachedError) {
      return NextResponse.json(
        { error: `You've used today's ${FREE_DAILY_REPLIES} free replies. Debates and Pro have no daily reply limit.` },
        { status: 429 },
      )
    }
    throw err
  }

  const assistantMessage: NewMessage = { ...userMessage, role: 'assistant', content: '', status: 'streaming', seq: seq + 1 }
  const batch = adminDb().batch()
  batch.set(userRef, { ...userMessage, ...created })
  batch.set(assistantRef, { ...assistantMessage, ...created })
  batch.update(conversationRef(cid), { updatedAt: FieldValue.serverTimestamp(), ...settingsUpdate })
  await batch.commit()

  const userView = toMessageView(userRef.id, userMessage)
  const modelMessages = toModelMessages([...unsummarized, userView], REPLY_BUDGET_CHARS + REPLY_SLACK_CHARS, summary)
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: ReplyStreamEvent) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          closed = true
        }
      }
      send({
        type: 'start',
        userMessage: toMessageView(userRef.id, userMessage),
        assistantMessage: toMessageView(assistantRef.id, assistantMessage),
      })

      // Generation is not tied to this connection: if the client leaves, the reply still
      // completes and is saved, and shows up when the conversation is reopened.
      void (async () => {
        let text = ''
        let status: 'complete' | 'error' = 'error'
        try {
          for await (const delta of streamReply(modelMessages)) {
            text += delta
            send({ type: 'token', text: delta })
          }
          await assistantRef.update({ content: text, status: 'complete' })
          status = 'complete'
          send({ type: 'done' })
        } catch (err) {
          console.error('[conversations] reply failed', cid, err)
          await assistantRef.update({ content: text, status: 'error' }).catch(() => {})
          send({ type: 'error', message: 'The reply failed. Try again.' })
        } finally {
          if (!closed) {
            closed = true
            controller.close()
          }
          if (isFirstMessage) await titleConversation(cid, content)
          const replied = toMessageView(assistantRef.id, { ...assistantMessage, content: text, status })
          await updateSummary(cid, { history: [...history, userView, replied], summary, summarizedThroughSeq })
        }
      })()
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
