import { adminDb } from '@/lib/firebase/admin'
import type { PanelDoc } from '@/types'

// Turns a debate's share link on or off (BL-049: single debates are shared, never whole
// conversations). The public page /p/[panelId] shows a debate only while isPublic is true.
// Returns false if the panel doesn't exist or isn't the user's.
export async function setPanelSharing(panelId: string, uid: string, isPublic: boolean): Promise<boolean> {
  const db = adminDb()
  const ref = db.collection('panels').doc(panelId)
  return db.runTransaction(async (tx) => {
    const panel = (await tx.get(ref)).data() as PanelDoc | undefined
    if (!panel || panel.userId !== uid) return false
    if (panel.isPublic !== isPublic) tx.update(ref, { isPublic })
    return true
  })
}
