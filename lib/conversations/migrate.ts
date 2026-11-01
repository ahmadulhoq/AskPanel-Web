import { FieldValue, Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { conversationRef, messagesRef } from './store'
import { planMigration, migratedIds, type MigratablePanel } from './migratePlan'
import type { PanelDoc } from '@/types'

// Puts a user's panels that aren't in a conversation into conversations (spec §10), so
// the conversation list shows everything. Runs when the dashboard loads: the first time it
// looks at every panel (v1 panels have no conversationId field), afterwards only at panels
// created outside a conversation (conversationId explicitly null). Idempotent: ids are
// derived from panel ids, so a re-run rewrites the same docs. Returns how many it moved.
export async function migrateUserPanels(uid: string): Promise<number> {
  const db = adminDb()
  const userRef = db.collection('users').doc(uid)
  const migratedBefore = Boolean((await userRef.get()).data()?.v1MigratedAt)

  const panels = db.collection('panels').where('userId', '==', uid)
  const docs: QueryDocumentSnapshot<DocumentData>[] = migratedBefore
    ? (await panels.where('conversationId', '==', null).get()).docs
    : (await panels.get()).docs.filter((d) => !d.data().conversationId)

  const byId = new Map(docs.map((d) => [d.id, d.data() as PanelDoc]))
  const plan = planMigration(docs.map((d): MigratablePanel => {
    const p = d.data() as PanelDoc
    return { id: d.id, parentPanelId: p.parentPanelId ?? null, createdAt: p.createdAt?.toMillis() ?? 0 }
  }))

  // A BulkWriter, not a batch: a long follow-up chain could exceed a batch's 500 writes.
  // Not atomic, but a re-run picks up whatever didn't get its conversationId.
  const writer = db.bulkWriter()
  for (const conversation of plan) {
    const root = byId.get(conversation.rootId)!
    const { conversationId } = migratedIds(conversation.rootId, conversation.rootId)
    const last = byId.get(conversation.panelIds.at(-1)!)!
    // A chain may continue an existing conversation (a follow-up of an already migrated
    // panel): then its parent's conversation is the one to add to.
    const parentConversation = root.parentPanelId
      ? ((await db.collection('panels').doc(root.parentPanelId).get()).data() as PanelDoc | undefined)?.conversationId ?? null
      : null
    const cid = parentConversation ?? conversationId

    if (!parentConversation) {
      writer.set(conversationRef(cid), {
        userId: uid,
        title: root.title ?? null,
        createdAt: root.createdAt ?? Timestamp.now(),
        updatedAt: last.createdAt ?? Timestamp.now(),
        debateCount: conversation.panelIds.length,
        migratedFrom: 'v1',
      }, { merge: true })
    } else {
      writer.update(conversationRef(cid), {
        updatedAt: last.createdAt ?? Timestamp.now(),
        debateCount: FieldValue.increment(conversation.panelIds.length),
      })
    }
    for (const panelId of conversation.panelIds) {
      const panel = byId.get(panelId)!
      const ids = migratedIds(conversation.rootId, panelId)
      const created = panel.createdAt ?? Timestamp.now()
      const seq = created.toMillis()
      writer.set(messagesRef(cid).doc(ids.userMessageId), {
        role: 'user', kind: 'text', content: panel.question, panelId: null, status: 'complete', seq, createdAt: created,
      })
      writer.set(messagesRef(cid).doc(ids.assistantMessageId), {
        role: 'assistant', kind: 'debate', content: '', panelId, status: 'complete', seq: seq + 1, createdAt: created,
      })
      writer.update(db.collection('panels').doc(panelId), { conversationId: cid, messageId: ids.assistantMessageId })
    }
  }
  await writer.close()

  if (!migratedBefore) await userRef.set({ v1MigratedAt: FieldValue.serverTimestamp() }, { merge: true })
  return docs.length
}
