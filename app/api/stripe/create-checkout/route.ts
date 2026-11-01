import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { getStripe } from '@/lib/stripe'

export async function POST() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = adminDb()
  const userSnap = await db.collection('users').doc(user.uid).get()
  const userData = userSnap.data()
  if (userData?.subscription?.tier === 'pro') {
    return NextResponse.json({ error: 'You already have Pro.' }, { status: 409 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const customerId: string | undefined = userData?.subscription?.stripeCustomerId ?? undefined

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
    // Returning subscribers reuse their Stripe customer instead of creating a duplicate.
    ...(customerId ? { customer: customerId } : { customer_email: userData?.email }),
    metadata: { uid: user.uid },
    // Subscription events (renewals, failed payments, cancellations) carry the uid too.
    subscription_data: { metadata: { uid: user.uid } },
    success_url: `${appUrl}/dashboard?upgraded=1`,
    cancel_url: `${appUrl}/dashboard`,
  })

  return NextResponse.json({ url: session.url })
}
