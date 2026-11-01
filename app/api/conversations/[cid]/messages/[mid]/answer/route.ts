import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { limitResponse } from '@/lib/limits/rateLimit'
import { stopIfRunning } from '@/lib/panels/delete'
import { replyHistory, toModelMessages, REPLY_BUDGET_CHARS, REPLY_LOAD_MESSAGES, REPLY_SLACK_CHARS } from '@/lib/conversations/context'
import { respond } from '@/lib/conversations/respond'
import { logRouting } from '@/lib/conversations/routingLog'
import { getOwnedConversation, loadMessages, messagesRef } from '@/lib/conversations/store'
import type { NewMessage } from '@/lib/conversations/store'

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

  const history = await loadMessages(cid, REPLY_LOAD_MESSAGES)
  const index = history.findIndex((m) => m.id === mid)
  const message = history[index]
  const coordinated = message?.routing && (message.kind === 'debate_proposal' || message.kind === 'debate')
  if (!message || !coordinated) {
    return NextResponse.json({ error: 'There is nothing to answer here.' }, { status: 409 })
  }
  if (message.kind === 'debate' && message.debate?.status === 'complete') {
    return NextResponse.json({ error: 'The panel has already answered.' }, { status: 409 })
  }
  const limited = await limitResponse('reply', user.uid)
  if (limited) return limited

  if (message.kind === 'debate' && message.panelId) await stopIfRunning(message.panelId, user.uid)

  const ref = messagesRef(cid).doc(mid)
  const assistantMessage: NewMessage = {
    role: 'assistant', kind: 'text', content: '', panelId: null, status: 'streaming', seq: message.seq, routing: null,
  }
  await ref.update({ kind: 'text', content: '', panelId: null, status: 'streaming', routing: null })
  logRouting(user.uid, cid, mid, 'just_answer', message.routing!.mode)

  const before = replyHistory(history.slice(0, index), conversation.summarizedThroughSeq ?? 0)
  return respond({
    cid,
    assistantRef: ref,
    assistantMessage,
    userMessage: null,
    modelMessages: toModelMessages(before, REPLY_BUDGET_CHARS + REPLY_SLACK_CHARS, conversation.summary ?? null),
  })
}
