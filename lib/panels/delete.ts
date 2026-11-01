import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { stopPanel, StopRejected } from './stop'
import type { PanelDoc } from '@/types'

// Deletes one of the user's panels, and its message if it was a debate in a conversation.
// A debate still running is stopped first, so the usual Stop refund rule applies.
// Returns false if the panel doesn't exist or isn't the user's.
export async function deletePanel(panelId: string, uid: string): Promise<boolean> {
  const db = adminDb()
  const ref = db.collection('panels').doc(panelId)
  const panel = (await ref.get()).data() as PanelDoc | undefined
  if (!panel || panel.userId !== uid) return false

  if (panel.status === 'queued' || panel.status === 'running') await stopIfRunning(panelId, uid)
  const batch = db.batch()
  batch.delete(ref)
  if (panel.conversationId && panel.messageId) {
    const conversation = db.collection('conversations').doc(panel.conversationId)
    batch.delete(conversation.collection('messages').doc(panel.messageId))
    batch.update(conversation, { debateCount: FieldValue.increment(-1) })
  }
  await batch.commit()
  return true
}

// Stops a debate before deletion so the Stop refund rule applies. "Already finished" is
// fine; any other failure aborts the deletion rather than skipping the refund.
export async function stopIfRunning(panelId: string, uid: string) {
  try {
    await stopPanel(panelId, uid)
  } catch (err) {
    if (!(err instanceof StopRejected)) throw err
  }
}
