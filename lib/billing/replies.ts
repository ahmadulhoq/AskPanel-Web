import { Timestamp, type DocumentReference, type Transaction } from 'firebase-admin/firestore'

// Free tier: 30 quick replies a day (BL-047 decision, 2026-11-01). Pro replies have no daily
// cap; the per-minute rate limit (lib/limits/rateLimit.ts) still applies.
export const FREE_DAILY_REPLIES = 30
const WINDOW_MS = 24 * 60 * 60 * 1000

export class ReplyLimitReachedError extends Error {
  constructor() {
    super('REPLY_LIMIT_REACHED')
  }
}

// Counts one quick reply against the free daily allowance inside the caller's transaction.
// Returns the user's tier.
export async function reserveReply(tx: Transaction, userRef: DocumentReference, now: number): Promise<'free' | 'pro'> {
  const userData = (await tx.get(userRef)).data()
  if (userData?.subscription?.tier === 'pro') return 'pro'

  let used: number = userData?.repliesUsed ?? 0
  const resetAt: number = userData?.repliesResetAt?.toMillis() ?? 0
  const updates: Record<string, unknown> = {}
  if (now >= resetAt) {
    used = 0
    updates.repliesResetAt = Timestamp.fromMillis(now + WINDOW_MS)
  }
  if (used >= FREE_DAILY_REPLIES) throw new ReplyLimitReachedError()
  updates.repliesUsed = used + 1
  tx.update(userRef, updates)
  return 'free'
}
