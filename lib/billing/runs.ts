import { Timestamp, type DocumentData, type DocumentReference, type Transaction } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'

export type Tier = 'free' | 'pro'

export const FREE_RUN_LIMIT = 5
// Pro's monthly ceiling (BL-035 decision, 2026-11-01), counted the same way as free runs.
export const PRO_RUN_LIMIT = 100
export const runLimit = (tier: Tier) => (tier === 'pro' ? PRO_RUN_LIMIT : FREE_RUN_LIMIT)
const RESET_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Out of debates for this 30-day window. `resetAt`: when the allowance comes back.
export class RunLimitReachedError extends Error {
  readonly resetAt: number
  constructor(code: string, resetAt: number) {
    super(code)
    this.resetAt = resetAt
  }
}
// Free: the upgrade dialog's job.
export class FreeLimitReachedError extends RunLimitReachedError {
  constructor(resetAt = 0) {
    super('FREE_LIMIT_REACHED', resetAt)
  }
}
// Pro: nothing to buy — more debates on the reset date.
export class ProLimitReachedError extends RunLimitReachedError {
  constructor(resetAt: number) {
    super('PRO_LIMIT_REACHED', resetAt)
  }
}

export const resetDateLabel = (resetAt: number) =>
  new Date(resetAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
export const proLimitMessage = (resetAt: number) =>
  `You've used your ${PRO_RUN_LIMIT} debates for this month. More from ${resetDateLabel(resetAt)}.`

// Counts a run against the user's allowance (free or Pro) inside the caller's transaction,
// applying the 30-day reset first. Counting at creation (not completion) is what stops
// anyone from starting many debates before any of them finishes. The counter keeps its v1
// name, `freeRunsUsed`, for both tiers. Runs are refunded on failure (refundRun).
export async function reserveRun(tx: Transaction, userRef: DocumentReference, now: number) {
  const userData = (await tx.get(userRef)).data()
  const tier: Tier = userData?.subscription?.tier === 'pro' ? 'pro' : 'free'

  const updates: Record<string, unknown> = {}
  let used: number = userData?.freeRunsUsed ?? 0
  let resetAt: number = userData?.freeRunsResetAt?.toMillis() ?? 0
  if (resetAt === 0 || now >= resetAt) {
    used = 0
    resetAt = now + RESET_INTERVAL_MS
    updates.freeRunsResetAt = Timestamp.fromMillis(resetAt)
  }
  if (used >= runLimit(tier)) throw tier === 'pro' ? new ProLimitReachedError(resetAt) : new FreeLimitReachedError(resetAt)

  updates.freeRunsUsed = used + 1
  tx.update(userRef, updates)
  // `windowEndsAt` goes on the panel (runWindowEndsAt), so a refund can tell which window
  // the run was counted in.
  return { tier, userData, windowEndsAt: resetAt }
}

// What's left of the user's allowance, for display. A window whose reset date has passed
// starts over at the next debate; `resetAt` is null then.
export function allowance(userData: DocumentData | undefined, now = Date.now()) {
  const tier: Tier = userData?.subscription?.tier === 'pro' ? 'pro' : 'free'
  const resetAt: number = userData?.freeRunsResetAt?.toMillis() ?? 0
  const open = resetAt > now
  const limit = runLimit(tier)
  return { tier, limit, left: Math.max(0, limit - (open ? userData?.freeRunsUsed ?? 0 : 0)), resetAt: open ? resetAt : null }
}

// Gives back a counted run when the panel fails. Idempotent: the panel's runCounted flag
// is cleared in the same transaction. A run counted in a window that has since reset isn't
// given back (the new window never counted it). Returns whether a run was given back.
export async function refundRun(panelId: string): Promise<boolean> {
  const db = adminDb()
  const panelRef = db.collection('panels').doc(panelId)
  return db.runTransaction(async (tx) => {
    const panel = (await tx.get(panelRef)).data()
    if (!panel?.runCounted) return false
    const userRef = db.collection('users').doc(panel.userId)
    const user = (await tx.get(userRef)).data()
    // Panels from before runWindowEndsAt existed: refunded as before.
    const sameWindow = !panel.runWindowEndsAt || user?.freeRunsResetAt?.toMillis() === panel.runWindowEndsAt
    if (sameWindow) tx.update(userRef, { freeRunsUsed: Math.max(0, (user?.freeRunsUsed ?? 0) - 1) })
    tx.update(panelRef, { runCounted: false })
    return sameWindow
  })
}
