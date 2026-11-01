import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { getStripe } from '@/lib/stripe'

export class AccountDeletionError extends Error {}

// Deletes a user's account and everything stored for it: an active Stripe subscription is
// cancelled first (so nobody is billed after deleting), then panels, conversations with
// their messages, rate-limit counters, the user doc, and finally the sign-in account —
// last, so a failure part-way leaves the user able to sign in and try again.
// Stripe keeps its own payment records, as it is legally required to.
export async function deleteAccount(uid: string): Promise<void> {
  const db = adminDb()
  const userRef = db.collection('users').doc(uid)
  const subscriptionId: string | null = (await userRef.get()).data()?.subscription?.stripeSubscriptionId ?? null

  if (subscriptionId) {
    try {
      await getStripe().subscriptions.cancel(subscriptionId)
    } catch (err) {
      // Already cancelled or gone is fine; anything else must stop the deletion.
      const code = (err as { code?: string }).code
      const status = (err as { statusCode?: number }).statusCode
      if (code !== 'resource_missing' && status !== 404) {
        console.error('[account] could not cancel subscription', uid, err)
        throw new AccountDeletionError('We could not cancel your subscription, so nothing was deleted. Please try again.')
      }
    }
  }

  // Debates still running stop on their own: the runner aborts when its panel doc is gone.
  const writer = db.bulkWriter()
  const [panels, conversations, limits] = await Promise.all([
    db.collection('panels').where('userId', '==', uid).select().get(),
    db.collection('conversations').where('userId', '==', uid).select().get(),
    db.collection('rateLimits').where('uid', '==', uid).select().get(),
  ])
  for (const doc of [...panels.docs, ...limits.docs]) writer.delete(doc.ref)
  for (const doc of conversations.docs) await db.recursiveDelete(doc.ref, writer)
  await db.recursiveDelete(userRef, writer)
  await writer.close()

  try {
    await adminAuth().deleteUser(uid)
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err
  }
}
