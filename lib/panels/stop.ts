import { adminDb } from '@/lib/firebase/admin'
import { refundRun } from '@/lib/billing/runs'
import { firstRoundComplete } from '@/lib/agents/runState'
import { compareRunCounts } from '@/lib/agents/compareState'
import type { PanelDoc } from '@/types'
import { STOPPED_MESSAGE } from './constants'

export class StopRejected extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Stops a queued or running debate on its owner's request. Clearing the lease makes the
// runner's next write fail, and the runner also watches for this to abort the model call
// in flight. A free run is refunded if stopped before round 1's verdict (spec §3.3), or in
// compare mode before all the options are in.
export async function stopPanel(panelId: string, uid: string): Promise<{ refunded: boolean }> {
  const db = adminDb()
  const ref = db.collection('panels').doc(panelId)

  const refundable = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new StopRejected(404, 'Not found')
    const panel = snap.data() as PanelDoc
    if (panel.userId !== uid) throw new StopRejected(404, 'Not found')
    if (panel.status !== 'queued' && panel.status !== 'running') {
      throw new StopRejected(409, 'This debate has already finished.')
    }
    tx.update(ref, {
      status: 'error',
      errorMessage: STOPPED_MESSAGE,
      stoppedAt: Date.now(),
      run: null,
      live: null,
    })
    return panel.mode === 'compare' ? !compareRunCounts(panel.compare) : !firstRoundComplete(panel.rounds ?? [])
  })

  // Pro runs aren't counted, so there is nothing to give back for them.
  return { refunded: refundable ? await refundRun(panelId) : false }
}
