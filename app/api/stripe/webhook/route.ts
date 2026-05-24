import { NextResponse, type NextRequest } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { adminDb } from '@/lib/firebase/admin'
import type Stripe from 'stripe'
import { Timestamp } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const db = adminDb()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const uid = session.metadata?.uid
    if (!uid) return NextResponse.json({ ok: true })

    const subscriptionId = session.subscription as string
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId)

    const userRef = db.collection('users').doc(uid)
    const snap = await userRef.get()
    // Idempotency: skip if already set to this subscription
    if (snap.data()?.subscription?.stripeSubscriptionId === subscriptionId) {
      return NextResponse.json({ ok: true })
    }

    await userRef.update({
      'subscription.tier': 'pro',
      'subscription.stripeCustomerId': session.customer as string,
      'subscription.stripeSubscriptionId': subscriptionId,
      'subscription.currentPeriodEnd': Timestamp.fromMillis(
        subscription.items.data[0].current_period_end * 1000,
      ),
    })
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription
    // Find user by stripeSubscriptionId
    const snap = await db
      .collection('users')
      .where('subscription.stripeSubscriptionId', '==', subscription.id)
      .limit(1)
      .get()

    if (!snap.empty) {
      await snap.docs[0].ref.update({
        'subscription.tier': 'free',
        'subscription.stripeSubscriptionId': null,
        'subscription.currentPeriodEnd': null,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
