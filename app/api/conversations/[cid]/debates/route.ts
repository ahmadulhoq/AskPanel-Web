import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { createPanel } from '@/lib/panels/create'
import { FreeLimitReachedError } from '@/lib/billing/runs'
import { debateContext } from '@/lib/conversations/context'
import { sanitizeDebateSettings } from '@/lib/conversations/settings'
import {
  conversationRef, getOwnedConversation, loadMessages, messagesRef, nextSeq, toMessageView,
} from '@/lib/conversations/store'
import type { NewMessage } from '@/lib/conversations/store'

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
      userContext: debateContext(
        history.slice(0, questionIndex).filter((m) => m.seq > (conversation.summarizedThroughSeq ?? 0)),
        undefined,
        conversation.summary ?? null,
      ),
      conversationId: cid,
      messageId: assistantRef.id,
    })
  } catch (err) {
    if (err instanceof FreeLimitReachedError) {
      return NextResponse.json({ error: 'FREE_LIMIT_REACHED' }, { status: 402 })
    }
    throw err
  }

  const message: NewMessage = {
    role: 'assistant', kind: 'debate', content: '', panelId, status: 'complete', seq: nextSeq(history),
  }
  const batch = adminDb().batch()
  batch.set(assistantRef, { ...message, createdAt: FieldValue.serverTimestamp() })
  batch.update(conversationRef(cid), { updatedAt: FieldValue.serverTimestamp(), ...settingsUpdate })
  await batch.commit()

  return NextResponse.json({
    message: toMessageView(assistantRef.id, message, { status: 'queued', finalAnswer: null, confidence: null }),
  })
}
