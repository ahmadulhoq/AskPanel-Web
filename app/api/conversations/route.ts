import { NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'

export async function POST() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ref = await adminDb().collection('conversations').add({
    userId: user.uid,
    title: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return NextResponse.json({ conversationId: ref.id })
}
