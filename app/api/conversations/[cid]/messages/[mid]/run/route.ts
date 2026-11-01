import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createPanel } from '@/lib/panels/create'
import { panelErrorResponse } from '@/lib/panels/errors'
import { debateContext, replyHistory, REPLY_LOAD_MESSAGES } from '@/lib/conversations/context'
import { sanitizeDebateSettings } from '@/lib/conversations/settings'
import { logRouting } from '@/lib/conversations/routingLog'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { getOwnedConversation, loadMessages, messagesRef, toMessageView } from '@/lib/conversations/store'
import type { NewMessage } from '@/lib/conversations/store'

// "Run the panel" on a debate the assistant proposed (free tier, spec §3.2).
export async function POST(request: NextRequest, { params }: { params: Promise<{ cid: string; mid: string }> }) {
  const { cid, mid } = await params
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const conversation = await getOwnedConversation(cid, user.uid)
  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Claim the proposal, so a double click or a second tab can't start (and charge) twice.
  const ref = messagesRef(cid).doc(mid)
  const CLAIM_MS = 60_000
  const proposal = await adminDb().runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data() as (NewMessage & { claimedAt?: number }) | undefined
    if (!data || data.kind !== 'debate_proposal' || !data.routing) return null
    if (data.claimedAt && Date.now() - data.claimedAt < CLAIM_MS) return null
    tx.update(ref, { claimedAt: Date.now() })
    return data
  })
  if (!proposal?.routing) {
    return NextResponse.json({ error: 'That suggestion is no longer open.' }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))
  const settings = sanitizeDebateSettings(body.settings)
  const history = await loadMessages(cid, REPLY_LOAD_MESSAGES, proposal.seq)
  const before = replyHistory(history, conversation.summarizedThroughSeq ?? 0)
  let panelId: string
  try {
    panelId = await createPanel({
      uid: user.uid,
      question: proposal.routing.question,
      isPublic: false,
      persona: settings.persona,
      maxRounds: settings.maxRounds,
      mode: proposal.routing.mode,
      userContext: debateContext(before, undefined, conversation.summary ?? null),
      conversationId: cid,
      messageId: mid,
    })
  } catch (err) {
    await ref.update({ claimedAt: FieldValue.delete() }).catch(() => {})
    const refused = panelErrorResponse(err)
    if (refused) return refused
    throw err
  }

  await ref.update({ kind: 'debate', panelId, claimedAt: FieldValue.delete() })
  logRouting(user.uid, cid, mid, 'run_proposal', proposal.routing.mode)
  const message: NewMessage = {
    role: 'assistant', kind: 'debate', content: '', panelId, status: 'complete', seq: proposal.seq, routing: proposal.routing,
  }
  return NextResponse.json({ message: toMessageView(mid, message, { status: 'queued', finalAnswer: null, confidence: null }) })
}
