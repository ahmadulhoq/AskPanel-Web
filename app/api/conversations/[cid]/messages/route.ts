import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { createPanel, MAX_CONTEXT_CHARS } from '@/lib/panels/create'
import { stopIfRunning } from '@/lib/panels/delete'
import { panelErrorResponse } from '@/lib/panels/errors'
import { FreeLimitReachedError } from '@/lib/billing/runs'
import { limitInTransaction, RateLimitedError, rateLimitedResponse } from '@/lib/limits/rateLimit'
import { reserveReply, ReplyLimitReachedError, FREE_DAILY_REPLIES } from '@/lib/billing/replies'
import {
  toModelMessages, debateBrief, replyHistory, REPLY_BUDGET_CHARS, REPLY_LOAD_MESSAGES, REPLY_SLACK_CHARS,
} from '@/lib/conversations/context'
import { respond } from '@/lib/conversations/respond'
import { logRouting } from '@/lib/conversations/routingLog'
import { titleConversation } from '@/lib/conversations/title'
import { updateSummary } from '@/lib/conversations/summary'
import { sanitizeDebateSettings } from '@/lib/conversations/settings'
import {
  conversationRef, getOwnedConversation, recountDebates, loadMessages, messagesRef, nextSeq, toMessageView,
} from '@/lib/conversations/store'
import type { NewMessage } from '@/lib/conversations/store'
import type { MessageRouting, MessageView } from '@/types'

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
  // Context attached to this message (pasted, or extracted from a link or file).
  const attachedContext = typeof body.context === 'string' && body.context.trim()
    ? body.context.trim().slice(0, MAX_CONTEXT_CHARS)
    : null
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
  const userMessage: NewMessage = {
    role: 'user', kind: 'text', content, panelId: null, status: 'complete', seq, ...(attachedContext ? { context: attachedContext } : {}),
  }
  // A debate's brief: the attached context first, then the conversation so far.
  const brief = () => debateBrief(attachedContext, unsummarized, summary, MAX_CONTEXT_CHARS)
  // Assistant messages never carry the user's attachment.
  const assistantBase: NewMessage = { role: 'assistant', kind: 'text', content: '', panelId: null, status: 'complete', seq: seq + 1 }
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
        userContext: brief(),
        conversationId: cid,
        messageId: assistantRef.id,
      })
    } catch (err) {
      const refused = panelErrorResponse(err)
      if (refused) return refused
      throw err
    }
    const assistantMessage: NewMessage = { ...assistantBase, kind: 'debate', panelId }
    const batch = adminDb().batch()
    batch.set(userRef, { ...userMessage, ...created })
    batch.set(assistantRef, { ...assistantMessage, ...created })
    batch.update(conversationRef(cid), { updatedAt: FieldValue.serverTimestamp(), ...settingsUpdate })
    await batch.commit()
    await recountDebates(cid)
    if (isFirstMessage) titleConversation(cid, content)
    logRouting(user.uid, cid, assistantRef.id, 'debate_button', debateSettings.mode)

    return NextResponse.json({
      messages: [
        toMessageView(userRef.id, userMessage),
        toMessageView(assistantRef.id, assistantMessage, { status: 'queued', finalAnswer: null, confidence: null }),
      ],
    })
  }

  let tier: 'free' | 'pro'
  try {
    tier = await adminDb().runTransaction(async (tx) => {
      const countReply = await limitInTransaction(tx, 'reply', user.uid)
      const t = await reserveReply(tx, adminDb().collection('users').doc(user.uid), Date.now())
      countReply()
      return t
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

  const assistantMessage: NewMessage = { ...assistantBase, status: 'streaming' }
  const batch = adminDb().batch()
  batch.set(userRef, { ...userMessage, ...created })
  batch.set(assistantRef, { ...assistantMessage, ...created })
  batch.update(conversationRef(cid), { updatedAt: FieldValue.serverTimestamp(), ...settingsUpdate })
  await batch.commit()

  const userView = toMessageView(userRef.id, userMessage)

  // The coordinator (spec §4): the reply model may send the message to the panel. Pro
  // starts the debate; free gets a proposal to run it or not (the tier rule is enforced
  // here, not by the model). If the debate can't start, it falls back to a proposal.
  const route = async (routing: MessageRouting): Promise<MessageView> => {
    if (tier === 'pro') {
      try {
        const panelId = await createPanel({
          uid: user.uid,
          question: routing.question,
          isPublic: false,
          persona: debateSettings.persona,
          maxRounds: debateSettings.maxRounds,
          mode: routing.mode,
          userContext: brief(),
          conversationId: cid,
          messageId: assistantRef.id,
        })
        const debate: NewMessage = { ...assistantMessage, kind: 'debate', content: '', panelId, status: 'complete', routing }
        try {
          await assistantRef.update({ kind: 'debate', content: '', panelId, status: 'complete', routing })
          await recountDebates(cid)
        } catch (err) {
          // Don't leave a debate running that the conversation can't show.
          await stopIfRunning(panelId, user.uid).catch(() => {})
          throw err
        }
        logRouting(user.uid, cid, assistantRef.id, 'debate', routing.mode)
        return toMessageView(assistantRef.id, debate, { status: 'queued', finalAnswer: null, confidence: null })
      } catch (err) {
        if (!(err instanceof FreeLimitReachedError || err instanceof RateLimitedError)) throw err
      }
    }
    const proposal: NewMessage = { ...assistantMessage, kind: 'debate_proposal', content: '', status: 'complete', routing }
    await assistantRef.update({ kind: 'debate_proposal', content: '', status: 'complete', routing })
    logRouting(user.uid, cid, assistantRef.id, 'propose', routing.mode)
    return toMessageView(assistantRef.id, proposal)
  }

  return respond({
    cid,
    assistantRef,
    assistantMessage,
    userMessage: userView,
    modelMessages: toModelMessages([...unsummarized, userView], REPLY_BUDGET_CHARS + REPLY_SLACK_CHARS, summary),
    route,
    after: async ({ text, status, routed }) => {
      if (!routed && status === 'complete') logRouting(user.uid, cid, assistantRef.id, 'answer')
      if (isFirstMessage) await titleConversation(cid, content)
      const replied = routed ? null : toMessageView(assistantRef.id, { ...assistantMessage, content: text, status })
      await updateSummary(cid, { history: [...history, userView, ...(replied ? [replied] : [])], summary, summarizedThroughSeq })
    },
  })
}
