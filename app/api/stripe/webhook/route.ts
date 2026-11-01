import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { Timestamp, type DocumentReference } from 'firebase-admin/firestore'
import { getStripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase/admin'
import { subscriptionFields, shouldApply, allowanceOnTierChange } from '@/lib/billing/subscription'

// Events to enable on the Stripe webhook endpoint.
const SUBSCRIPTION_EVENTS = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (!SUBSCRIPTION_EVENTS.has(event.type)) {
    return NextResponse.json({ ok: true })
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.mode === 'subscription' && session.subscription) {
        const id = typeof session.subscription === 'string' ? session.subscription : session.subscription.id
        await syncSubscription(id, session.metadata?.uid)
      }
    } else {
      const sub = event.data.object as Stripe.Subscription
      await syncSubscription(sub.id, sub.metadata?.uid)
    }
  } catch (err) {
    console.error('[stripe] webhook processing failed', event.id, event.type, err)
    // A non-2xx response makes Stripe retry the event.
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// Applies the subscription's *current* state from Stripe rather than the event payload,
// so duplicate, late or out-of-order events all converge on the same result.
async function syncSubscription(subscriptionId: string, uidHint: string | undefined) {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId)
  const fields = subscriptionFields(sub)
  const userRef = await findUser(uidHint ?? sub.metadata?.uid, fields.subscriptionId, fields.customerId)
  if (!userRef) {
    console.warn('[stripe] no user for subscription', fields.subscriptionId)
    return
  }

  await adminDb().runTransaction(async (tx) => {
    const current = (await tx.get(userRef)).data()?.subscription
    if (!shouldApply(current?.stripeSubscriptionId ?? null, fields)) return
    tx.update(userRef, {
      'subscription.tier': fields.tier,
      'subscription.status': fields.status,
      'subscription.stripeCustomerId': fields.customerId,
      'subscription.stripeSubscriptionId': fields.subscriptionId,
      'subscription.currentPeriodEnd': fields.currentPeriodEndMs ? Timestamp.fromMillis(fields.currentPeriodEndMs) : null,
      'subscription.cancelAtPeriodEnd': fields.cancelAtPeriodEnd,
      ...allowanceOnTierChange(current?.tier, fields.tier),
    })
  })
}

async function findUser(uid: string | undefined, subscriptionId: string, customerId: string): Promise<DocumentReference | null> {
  const users = adminDb().collection('users')
  if (uid) {
    const ref = users.doc(uid)
    if ((await ref.get()).exists) return ref
  }
  for (const [field, value] of [
    ['subscription.stripeSubscriptionId', subscriptionId],
    ['subscription.stripeCustomerId', customerId],
  ] as const) {
    const snap = await users.where(field, '==', value).limit(1).get()
    if (!snap.empty) return snap.docs[0].ref
  }
  return null
}
