import { adminDb } from '@/lib/firebase/admin'
import { stopPanel } from '@/lib/panels/stop'
import { conversationRef, getOwnedConversation } from './store'
import type { PanelDoc } from '@/types'

// Deletes a conversation, its messages, and the debates started in it. Running debates are
// stopped first (usual refund rule). Returns false if it isn't the user's.
export async function deleteConversation(cid: string, uid: string): Promise<boolean> {
  if (!(await getOwnedConversation(cid, uid))) return false
  const db = adminDb()
  const panels = await db.collection('panels').where('conversationId', '==', cid).get()
  const writer = db.bulkWriter()
  for (const doc of panels.docs) {
    const panel = doc.data() as PanelDoc
    if (panel.userId !== uid) continue
    if (panel.status === 'queued' || panel.status === 'running') {
      await stopPanel(doc.id, uid).catch(() => {})
    }
    writer.delete(doc.ref)
  }
  await db.recursiveDelete(conversationRef(cid), writer)
  await writer.close()
  return true
}
