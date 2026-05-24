import { NextResponse, type NextRequest } from 'next/server'
import { createSessionCookie, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { adminAuth } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

export async function POST(request: NextRequest) {
  const { idToken } = await request.json()
  if (!idToken) {
    return NextResponse.json({ error: 'Missing idToken' }, { status: 400 })
  }

  let decodedToken
  try {
    decodedToken = await adminAuth().verifyIdToken(idToken)
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }

  const sessionCookie = await createSessionCookie(idToken)

  // Upsert user doc in Firestore
  const db = adminDb()
  const userRef = db.collection('users').doc(decodedToken.uid)
  const snap = await userRef.get()
  if (!snap.exists) {
    await userRef.set({
      email: decodedToken.email ?? '',
      displayName: decodedToken.name ?? '',
      photoURL: decodedToken.picture ?? null,
      createdAt: FieldValue.serverTimestamp(),
      freeRunsUsed: 0,
      subscription: {
        tier: 'free',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodEnd: null,
      },
    })
  }

  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
    maxAge: SESSION_DURATION_MS / 1000,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
