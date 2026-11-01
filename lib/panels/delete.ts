import { adminDb } from '@/lib/firebase/admin'
import { stopPanel } from './stop'
import type { PanelDoc } from '@/types'

// Deletes one of the user's panels, and its message if it was a debate in a conversation.
// A debate still running is stopped first, so the usual Stop refund rule applies.
// Returns false if the panel doesn't exist or isn't the user's.
export async function deletePanel(panelId: string, uid: string): Promise<boolean> {
  const db = adminDb()
  const ref = db.collection('panels').doc(panelId)
  const panel = (await ref.get()).data() as PanelDoc | undefined
  if (!panel || panel.userId !== uid) return false

  if (panel.status === 'queued' || panel.status === 'running') {
    await stopPanel(panelId, uid).catch(() => {}) // it may have just finished
  }
  const batch = db.batch()
  batch.delete(ref)
  if (panel.conversationId && panel.messageId) {
    batch.delete(db.collection('conversations').doc(panel.conversationId).collection('messages').doc(panel.messageId))
  }
  await batch.commit()
  return true
}
