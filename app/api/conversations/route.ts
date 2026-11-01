import { NextResponse, type NextRequest } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { listConversations } from '@/lib/conversations/list'

// GET /api/conversations?cursor=<next> — the next page of the conversation list.
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await listConversations(user.uid, request.nextUrl.searchParams.get('cursor') ?? undefined))
}

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
    debateCount: 0,
  })
  return NextResponse.json({ conversationId: ref.id })
}
