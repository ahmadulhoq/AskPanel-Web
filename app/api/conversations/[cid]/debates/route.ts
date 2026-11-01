import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { createPanel, MAX_CONTEXT_CHARS } from '@/lib/panels/create'
import { panelErrorResponse } from '@/lib/panels/errors'
import { debateBrief } from '@/lib/conversations/context'
import { sanitizeDebateSettings } from '@/lib/conversations/settings'
import { logRouting } from '@/lib/conversations/routingLog'
import {
  conversationRef, getOwnedConversation, recountDebates, loadMessages, messagesRef, nextSeq, toMessageView,
} from '@/lib/conversations/store'
import type { NewMessage } from '@/lib/conversations/store'
import type { ConversationDoc, MessageView } from '@/types'

// Background for a debate on history[questionIndex]. The rolling summary is used only if it
// covers nothing from the question onwards; for an older question it would leak what came
// after, so the messages before it are used instead.
function briefBefore(history: MessageView[], questionIndex: number, conversation: ConversationDoc) {
  const through = conversation.summarizedThroughSeq ?? 0
  const question = history[questionIndex]
  const before = history.slice(0, questionIndex)
  if (conversation.summary && question.seq > through) {
    return debateBrief(question.context, before.filter((m) => m.seq > through), conversation.summary, MAX_CONTEXT_CHARS)
  }
  return debateBrief(question.context, before, null, MAX_CONTEXT_CHARS)
}

// "Debate this": run the panel on the user message that a quick reply answered.
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
  const history = await loadMessages(cid, 200)
  const replyIndex = history.findIndex((m) => m.id === body.messageId && m.role === 'assistant' && m.kind === 'text')
  if (replyIndex === -1) {
    return NextResponse.json({ error: 'That reply was not found.' }, { status: 404 })
  }
  let questionIndex = replyIndex - 1
  while (questionIndex >= 0 && history[questionIndex].role !== 'user') questionIndex--
  const question = history[questionIndex]?.content.trim() ?? ''
  if (question.length < 10) {
    return NextResponse.json({ error: 'Give the panel a bit more to debate (at least 10 characters).' }, { status: 400 })
  }

  const debateSettings = sanitizeDebateSettings(body.settings)
  const settingsUpdate = body.settings ? { debateSettings } : {}
  const assistantRef = messagesRef(cid).doc()
  let panelId: string
  try {
    panelId = await createPanel({
      uid: user.uid,
      question,
      isPublic: false,
      persona: debateSettings.persona,
      maxRounds: debateSettings.maxRounds,
      mode: debateSettings.mode,
      userContext: briefBefore(history, questionIndex, conversation),
      conversationId: cid,
      messageId: assistantRef.id,
    })
  } catch (err) {
    const refused = panelErrorResponse(err)
    if (refused) return refused
    throw err
  }

  const message: NewMessage = {
    role: 'assistant', kind: 'debate', content: '', panelId, status: 'complete', seq: nextSeq(history),
  }
  const batch = adminDb().batch()
  batch.set(assistantRef, { ...message, createdAt: FieldValue.serverTimestamp() })
  batch.update(conversationRef(cid), { updatedAt: FieldValue.serverTimestamp(), ...settingsUpdate })
  await batch.commit()
  await recountDebates(cid)
  logRouting(user.uid, cid, history[replyIndex].id, 'debate_this', debateSettings.mode)

  return NextResponse.json({
    message: toMessageView(assistantRef.id, message, { status: 'queued', finalAnswer: null, confidence: null }),
  })
}
