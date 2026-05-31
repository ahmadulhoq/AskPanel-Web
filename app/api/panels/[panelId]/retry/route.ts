import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ panelId: string }> },
) {
  const { panelId } = await params
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = adminDb()
  const snap = await db.collection('panels').doc(panelId).get()
  if (!snap.exists) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const data = snap.data()!
  if (data.userId !== user.uid) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (data.status !== 'error') {
    return NextResponse.json({ error: 'Panel is not in error state' }, { status: 409 })
  }

  await db.collection('panels').doc(panelId).update({
    status: 'queued',
    errorMessage: null,
    rounds: [],
    finalAnswer: null,
    confidence: null,
    completedAt: null,
  })

  return NextResponse.json({ ok: true })
}
