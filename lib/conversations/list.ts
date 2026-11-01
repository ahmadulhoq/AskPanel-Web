import { FieldPath, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import type { ConversationDoc, ConversationSummary } from '@/types'

export const CONVERSATION_PAGE_SIZE = 30

export interface ConversationPage {
  conversations: ConversationSummary[]
  next: string | null
}

// Same exact (timestamp, id) cursor as the panel list (lib/panels/list.ts).
const encodeCursor = (at: Timestamp, id: string) => `${at.seconds}.${at.nanoseconds}.${id}`
function decodeCursor(cursor: string): [Timestamp, string] | null {
  const m = /^(\d{1,12})\.(\d{1,9})\.([A-Za-z0-9_-]{1,64})$/.exec(cursor)
  return m ? [new Timestamp(Number(m[1]), Number(m[2])), m[3]] : null
}

// One page of the user's conversations, most recently active first.
export async function listConversations(uid: string, cursor?: string): Promise<ConversationPage> {
  let query = adminDb()
    .collection('conversations')
    .where('userId', '==', uid)
    .orderBy('updatedAt', 'desc')
    .orderBy(FieldPath.documentId(), 'desc')
  if (cursor) {
    const after = decodeCursor(cursor)
    if (!after) return { conversations: [], next: null }
    query = query.startAfter(...after)
  }
  const snap = await query.limit(CONVERSATION_PAGE_SIZE + 1).get()
  const docs = snap.docs.slice(0, CONVERSATION_PAGE_SIZE)
  const last = docs.at(-1)
  const lastAt = last?.data().updatedAt as Timestamp | undefined
  return {
    conversations: docs.map((d) => {
      const c = d.data() as ConversationDoc
      return { id: d.id, title: c.title, updatedAt: c.updatedAt?.toMillis() ?? 0, debateCount: c.debateCount ?? 0 }
    }),
    next: snap.docs.length > CONVERSATION_PAGE_SIZE && last && lastAt ? encodeCursor(lastAt, last.id) : null,
  }
}
