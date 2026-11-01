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
  if (subscriptionId) await cancelSubscription(uid, subscriptionId)

  // Debates still running stop on their own: the runner aborts when its panel doc is gone.
  // Conversation messages can't be recreated afterwards: every message write also updates
  // the conversation doc, which fails once it is gone.
  await deleteUserData(uid)
  await db.recursiveDelete(userRef)

  try {
    await adminAuth().deleteUser(uid)
  } catch (err) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err
  }
  // A request that was already past its auth check may have created a panel meanwhile.
  // New requests can't: the session is checked for revocation, and the user is gone.
  await deleteUserData(uid)
}

async function deleteUserData(uid: string) {
  const db = adminDb()
  const [panels, conversations, limits] = await Promise.all([
    db.collection('panels').where('userId', '==', uid).select().get(),
    db.collection('conversations').where('userId', '==', uid).select().get(),
    db.collection('rateLimits').where('uid', '==', uid).select().get(),
  ])
  const writer = db.bulkWriter()
  for (const doc of [...panels.docs, ...limits.docs]) writer.delete(doc.ref)
  await Promise.all(conversations.docs.map((doc) => db.recursiveDelete(doc.ref, writer)))
  await writer.close()
}

// Cancels a subscription that can still bill. One that has already ended is left alone
// (Stripe refuses to cancel it again); a failure on a live one stops the deletion.
async function cancelSubscription(uid: string, subscriptionId: string) {
  const stripe = getStripe()
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId)
    if (sub.status === 'canceled' || sub.status === 'incomplete_expired') return
    await stripe.subscriptions.cancel(subscriptionId)
  } catch (err) {
    if ((err as { code?: string }).code === 'resource_missing') return
    console.error('[account] could not cancel subscription', uid, err)
    throw new AccountDeletionError('We could not cancel your subscription, so nothing was deleted. Please try again.')
  }
}
