import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createPanel } from '@/lib/panels/create'
import { FreeLimitReachedError } from '@/lib/billing/runs'
import { RateLimitedError, rateLimitedResponse } from '@/lib/limits/rateLimit'
import { debateContext, replyHistory, REPLY_LOAD_MESSAGES } from '@/lib/conversations/context'
import { sanitizeDebateSettings } from '@/lib/conversations/settings'
import { logRouting } from '@/lib/conversations/routingLog'
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

  const history = await loadMessages(cid, REPLY_LOAD_MESSAGES)
  const index = history.findIndex((m) => m.id === mid)
  const proposal = history[index]
  if (!proposal || proposal.kind !== 'debate_proposal' || !proposal.routing) {
    return NextResponse.json({ error: 'That suggestion is no longer open.' }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))
  const settings = sanitizeDebateSettings(body.settings)
  const summary = conversation.summary ?? null
  const before = replyHistory(history.slice(0, index), conversation.summarizedThroughSeq ?? 0)
  let panelId: string
  try {
    panelId = await createPanel({
      uid: user.uid,
      question: proposal.routing.question,
      isPublic: false,
      persona: settings.persona,
      maxRounds: settings.maxRounds,
      mode: proposal.routing.mode,
      userContext: debateContext(before, undefined, summary),
      conversationId: cid,
      messageId: mid,
    })
  } catch (err) {
    if (err instanceof FreeLimitReachedError) {
      return NextResponse.json({ error: 'FREE_LIMIT_REACHED' }, { status: 402 })
    }
    if (err instanceof RateLimitedError) return rateLimitedResponse(err)
    throw err
  }

  await messagesRef(cid).doc(mid).update({ kind: 'debate', panelId })
  logRouting(user.uid, cid, mid, 'run_proposal', proposal.routing.mode)
  const message: NewMessage = {
    role: 'assistant', kind: 'debate', content: '', panelId, status: 'complete', seq: proposal.seq, routing: proposal.routing,
  }
  return NextResponse.json({ message: toMessageView(mid, message, { status: 'queued', finalAnswer: null, confidence: null }) })
}
