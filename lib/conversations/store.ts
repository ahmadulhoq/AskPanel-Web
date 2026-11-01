import { adminDb } from '@/lib/firebase/admin'
import type { ConversationDoc, MessageDoc, MessageView, PanelDoc } from '@/types'

// A reply still "streaming" after this long was cut off (e.g. the server restarted).
const STALE_STREAM_MS = 5 * 60 * 1000

export const conversationRef = (cid: string) => adminDb().collection('conversations').doc(cid)
export const messagesRef = (cid: string) => conversationRef(cid).collection('messages')

export async function getOwnedConversation(cid: string, uid: string): Promise<ConversationDoc | null> {
  const snap = await conversationRef(cid).get()
  const data = snap.data() as ConversationDoc | undefined
  return data && data.userId === uid ? data : null
}

export type NewMessage = Omit<MessageDoc, 'createdAt'>

export function toMessageView(id: string, m: NewMessage, debate: MessageView['debate'] = null): MessageView {
  const stale = m.status === 'streaming' && m.seq < Date.now() - STALE_STREAM_MS
  return {
    id,
    role: m.role,
    kind: m.kind,
    content: m.content,
    status: stale ? 'error' : m.status,
    seq: m.seq,
    panelId: m.panelId,
    debate,
    routing: m.routing ?? null,
    context: m.context ?? null,
  }
}

// The latest `limit` messages (before `beforeSeq`, if given), oldest first, with each
// debate's current status and verdict.
export async function loadMessages(cid: string, limit = 200, beforeSeq?: number): Promise<MessageView[]> {
  let query = messagesRef(cid).orderBy('seq', 'desc')
  if (beforeSeq !== undefined) query = query.where('seq', '<', beforeSeq)
  const snap = await query.limit(limit).get()
  const docs = snap.docs.reverse().map((d) => ({ id: d.id, data: d.data() as MessageDoc }))

  const panelIds = docs.map((d) => d.data.panelId).filter((id): id is string => !!id)
  const panels = new Map<string, PanelDoc>()
  if (panelIds.length) {
    const db = adminDb()
    const snaps = await db.getAll(...panelIds.map((id) => db.collection('panels').doc(id)))
    for (const s of snaps) if (s.exists) panels.set(s.id, s.data() as PanelDoc)
  }

  return docs.map(({ id, data }) => {
    const panel = data.panelId ? panels.get(data.panelId) : undefined
    const debate = panel
      ? { status: panel.status, finalAnswer: panel.finalAnswer, confidence: panel.confidence, stopped: !!panel.stoppedAt }
      : null
    return toMessageView(id, data, debate)
  })
}

// Next ordering key: wall-clock ms, but always after the last message.
export const nextSeq = (history: MessageView[]) => Math.max(Date.now(), (history.at(-1)?.seq ?? 0) + 1)

// One message, read directly.
export async function getMessage(cid: string, mid: string): Promise<(NewMessage & { id: string }) | null> {
  const snap = await messagesRef(cid).doc(mid).get()
  return snap.exists ? { id: snap.id, ...(snap.data() as NewMessage) } : null
}

