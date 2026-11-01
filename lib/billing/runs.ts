import { Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'

export const FREE_RUN_LIMIT = 5
const RESET_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export class FreeLimitReachedError extends Error {
  constructor() {
    super('FREE_LIMIT_REACHED')
  }
}

// Counts a run against the free allowance inside the caller's transaction, applying the
// monthly reset first. Counting at creation (not completion) is what stops a free user from
// starting many panels before any of them finishes. Returns whether the run was counted.
export async function reserveRun(tx: Transaction, userRef: DocumentReference, now: number) {
  const userData = (await tx.get(userRef)).data()
  const tier: 'free' | 'pro' = userData?.subscription?.tier ?? 'free'
  if (tier === 'pro') return { tier, counted: false, userData }

  const updates: Record<string, unknown> = {}
  let used: number = userData?.freeRunsUsed ?? 0
  const resetAt: number = userData?.freeRunsResetAt?.toMillis() ?? 0
  if (resetAt === 0 || now >= resetAt) {
    used = 0
    updates.freeRunsResetAt = Timestamp.fromMillis(now + RESET_INTERVAL_MS)
  }
  if (used >= FREE_RUN_LIMIT) throw new FreeLimitReachedError()

  updates.freeRunsUsed = used + 1
  tx.update(userRef, updates)
  return { tier, counted: true, userData }
}

// Gives back a counted run when the panel fails. Idempotent: the panel's runCounted flag
// is cleared in the same transaction. Returns whether a run was actually given back.
export async function refundRun(panelId: string): Promise<boolean> {
  const db = adminDb()
  const panelRef = db.collection('panels').doc(panelId)
  return db.runTransaction(async (tx) => {
    const panel = (await tx.get(panelRef)).data()
    if (!panel?.runCounted) return false
    const userRef = db.collection('users').doc(panel.userId)
    const used: number = (await tx.get(userRef)).data()?.freeRunsUsed ?? 0
    tx.update(userRef, { freeRunsUsed: Math.max(0, used - 1) })
    tx.update(panelRef, { runCounted: false })
    return true
  })
}
