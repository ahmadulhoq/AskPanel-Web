import { NextResponse, type NextRequest } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { getSessionUser } from '@/lib/auth'
import { limitResponse } from '@/lib/limits/rateLimit'
import { stopPanel, StopRejected } from '@/lib/panels/stop'
import { replyHistory, toModelMessages, REPLY_BUDGET_CHARS, REPLY_LOAD_MESSAGES, REPLY_SLACK_CHARS } from '@/lib/conversations/context'
import { respond } from '@/lib/conversations/respond'
import { logRouting } from '@/lib/conversations/routingLog'
import { updateSummary } from '@/lib/conversations/summary'
import { getMessage, getOwnedConversation, loadMessages, messagesRef, toMessageView } from '@/lib/conversations/store'
import type { NewMessage } from '@/lib/conversations/store'
import type { PanelDoc } from '@/types'

// "Just answer" (spec §3.2): turn a debate the assistant proposed — or started, if it is
// still running — into a direct reply, streamed like any reply. A started debate is
// stopped (usual refund rule). Doesn't count against the daily reply allowance again.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ cid: string; mid: string }> }) {
  const { cid, mid } = await params
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const conversation = await getOwnedConversation(cid, user.uid)
  if (!conversation) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const message = await getMessage(cid, mid)
  if (!message?.routing || (message.kind !== 'debate_proposal' && message.kind !== 'debate')) {
    return NextResponse.json({ error: 'There is nothing to answer here.' }, { status: 409 })
  }
  const limited = await limitResponse('reply', user.uid)
  if (limited) return limited

  // A started debate: stop it first. If it has already finished, keep its verdict.
  const panelId = message.kind === 'debate' ? message.panelId : null
  if (panelId) {
    try {
      await stopPanel(panelId, user.uid)
    } catch (err) {
      if (!(err instanceof StopRejected)) throw err
      const panel = (await adminDb().collection('panels').doc(panelId).get()).data() as PanelDoc | undefined
      if (panel?.status === 'complete') {
        return NextResponse.json({ error: 'The panel has already answered.' }, { status: 409 })
      }
    }
  }

  // Claim the message: a double click or a second tab gets a 409 instead of a second stream.
  const ref = messagesRef(cid).doc(mid)
  const claimed = await adminDb().runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data() as NewMessage | undefined
    if (!data?.routing || data.kind !== message.kind) return false
    tx.update(ref, { kind: 'text', content: '', panelId: null, status: 'streaming', routing: null })
    // The stopped panel no longer owns this message; deleting it later must not delete the answer.
    if (panelId) tx.update(adminDb().collection('panels').doc(panelId), { messageId: null })
    return true
  })
  if (!claimed) {
    return NextResponse.json({ error: 'There is nothing to answer here.' }, { status: 409 })
  }
  logRouting(user.uid, cid, mid, 'just_answer', message.routing.mode)

  const assistantMessage: NewMessage = {
    role: 'assistant', kind: 'text', content: '', panelId: null, status: 'streaming', seq: message.seq, routing: null,
  }
  const summary = conversation.summary ?? null
  const summarizedThroughSeq = conversation.summarizedThroughSeq ?? 0
  const history = await loadMessages(cid, REPLY_LOAD_MESSAGES, message.seq)
  return respond({
    cid,
    assistantRef: ref,
    assistantMessage,
    userMessage: null,
    modelMessages: toModelMessages(replyHistory(history, summarizedThroughSeq), REPLY_BUDGET_CHARS + REPLY_SLACK_CHARS, summary),
    after: async ({ text, status }) => {
      const replied = toMessageView(mid, { ...assistantMessage, content: text, status })
      await updateSummary(cid, { history: [...history, replied], summary, summarizedThroughSeq })
    },
  })
}
