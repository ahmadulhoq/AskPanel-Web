import { FieldValue, Timestamp, type DocumentData, type QueryDocumentSnapshot } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { conversationRef, messagesRef, recountDebates } from './store'
import { planMigration, migratedIds, type MigratablePanel } from './migratePlan'
import type { PanelDoc } from '@/types'

// Puts a user's panels that aren't in a conversation into conversations (spec §10), so
// the conversation list shows everything. Runs when the dashboard loads. Until it has
// fully succeeded once (`v1MigratedAt`), it looks at every panel — v1 panels have no
// conversationId field, which a `== null` query can't find. Afterwards it only looks at
// panels created outside a conversation (conversationId explicitly null). Idempotent: ids
// derive from panel ids and debate counts are recounted, so overlapping or repeated runs
// converge. Returns how many panels it moved.
export async function migrateUserPanels(uid: string, migratedBefore: boolean): Promise<number> {
  const db = adminDb()
  const panels = db.collection('panels').where('userId', '==', uid)
  const docs: QueryDocumentSnapshot<DocumentData>[] = migratedBefore
    ? (await panels.where('conversationId', '==', null).get()).docs
    : (await panels.get()).docs.filter((d) => !d.data().conversationId)

  const byId = new Map(docs.map((d) => [d.id, d.data() as PanelDoc]))
  const plan = planMigration(docs.map((d): MigratablePanel => {
    const p = d.data() as PanelDoc
    return { id: d.id, parentPanelId: p.parentPanelId ?? null, createdAt: p.createdAt?.toMillis() ?? 0 }
  }))

  // A chain may continue an existing conversation (a follow-up of an already migrated
  // panel): then it is added to its parent's conversation. Looked up in parallel.
  const parentIds = [...new Set(plan.map((c) => byId.get(c.rootId)!.parentPanelId).filter((id): id is string => !!id))]
  const parents = parentIds.length ? await db.getAll(...parentIds.map((id) => db.collection('panels').doc(id))) : []
  const parentConversation = new Map(parents.map((s) => [s.id, (s.data() as PanelDoc | undefined)?.conversationId ?? null]))

  // A BulkWriter, not a batch: a long follow-up chain could exceed a batch's 500 writes.
  const writer = db.bulkWriter()
  // Handlers are attached as each write is queued (the writer only sends on flush/close).
  let failed = 0
  const writes: Promise<void>[] = []
  const track = (write: Promise<unknown>) => writes.push(write.then(() => {}, () => { failed++ }))
  const touched = new Set<string>()
  for (const conversation of plan) {
    const root = byId.get(conversation.rootId)!
    const last = byId.get(conversation.panelIds.at(-1)!)!
    const existing = root.parentPanelId ? parentConversation.get(root.parentPanelId) ?? null : null
    const cid = existing ?? migratedIds(conversation.rootId, conversation.rootId).conversationId
    touched.add(cid)

    track(existing
      ? writer.update(conversationRef(cid), { updatedAt: last.createdAt ?? Timestamp.now() })
      : writer.set(conversationRef(cid), {
        userId: uid,
        title: root.title ?? null,
        createdAt: root.createdAt ?? Timestamp.now(),
        updatedAt: last.createdAt ?? Timestamp.now(),
        migratedFrom: 'v1',
      }, { merge: true }))
    for (const panelId of conversation.panelIds) {
      const panel = byId.get(panelId)!
      const ids = migratedIds(conversation.rootId, panelId)
      const created = panel.createdAt ?? Timestamp.now()
      const seq = created.toMillis()
      track(writer.set(messagesRef(cid).doc(ids.userMessageId), {
        role: 'user', kind: 'text', content: panel.question, panelId: null, status: 'complete', seq, createdAt: created,
      }))
      track(writer.set(messagesRef(cid).doc(ids.assistantMessageId), {
        role: 'assistant', kind: 'debate', content: '', panelId, status: 'complete', seq: seq + 1, createdAt: created,
      }))
      track(writer.update(db.collection('panels').doc(panelId), { conversationId: cid, messageId: ids.assistantMessageId }))
    }
  }
  await writer.close()
  await Promise.all(writes)
  if (failed) console.error('[migrate] some writes failed; will retry on the next visit', uid, failed)

  // First pass: also backfill debate counts on conversations created before they existed.
  if (!migratedBefore) {
    const all = await db.collection('conversations').where('userId', '==', uid).select().get()
    for (const doc of all.docs) touched.add(doc.id)
  }
  await Promise.all([...touched].map((cid) => recountDebates(cid)))

  // Only once everything went through: until then, every visit re-scans all panels.
  if (!migratedBefore && failed === 0) {
    await db.collection('users').doc(uid).set({ v1MigratedAt: FieldValue.serverTimestamp() }, { merge: true })
  }
  return failed ? 0 : docs.length
}
