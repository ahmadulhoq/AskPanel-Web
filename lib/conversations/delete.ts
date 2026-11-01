import { adminDb } from '@/lib/firebase/admin'
import { stopIfRunning } from '@/lib/panels/delete'
import { conversationRef, getOwnedConversation } from './store'
import type { PanelDoc } from '@/types'

// Deletes a conversation, its messages, and the debates started in it. Running debates are
// stopped first (usual refund rule). Returns false if it isn't the user's.
export async function deleteConversation(cid: string, uid: string): Promise<boolean> {
  if (!(await getOwnedConversation(cid, uid))) return false
  const db = adminDb()
  const panels = (await db.collection('panels').where('conversationId', '==', cid).get()).docs
    .filter((doc) => (doc.data() as PanelDoc).userId === uid)
  await Promise.all(panels
    .filter((doc) => ['queued', 'running'].includes((doc.data() as PanelDoc).status))
    .map((doc) => stopIfRunning(doc.id, uid)))

  // Deleting the conversation doc first means no new message can be added to it (message
  // writes also update the conversation doc, which then fails).
  const writer = db.bulkWriter()
  await db.recursiveDelete(conversationRef(cid), writer)
  for (const doc of panels) writer.delete(doc.ref)
  await writer.close()
  // A debate created by a request already in flight would be left behind; sweep once more.
  const late = await db.collection('panels').where('conversationId', '==', cid).where('userId', '==', uid).get()
  await Promise.all(late.docs.map((doc) => doc.ref.delete()))
  return true
}
