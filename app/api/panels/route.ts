import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { nanoid } from 'nanoid'
import { FieldValue } from 'firebase-admin/firestore'
import { DEFAULT_MODEL } from '@/lib/anthropic'

const FREE_RUN_LIMIT = 5

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { question } = await request.json()
  if (!question || typeof question !== 'string' || question.trim().length < 10) {
    return NextResponse.json({ error: 'Question must be at least 10 characters' }, { status: 400 })
  }

  const db = adminDb()
  const userRef = db.collection('users').doc(user.uid)

  // Atomically check + reserve a run slot
  const panelId = nanoid(12)

  try {
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef)
      const userData = userSnap.data()

      const tier = userData?.subscription?.tier ?? 'free'
      const freeRunsUsed = userData?.freeRunsUsed ?? 0

      if (tier !== 'pro' && freeRunsUsed >= FREE_RUN_LIMIT) {
        throw new Error('FREE_LIMIT_REACHED')
      }

      const panelRef = db.collection('panels').doc(panelId)
      tx.set(panelRef, {
        userId: user.uid,
        question: question.trim(),
        status: 'queued',
        isPublic: true,
        createdAt: FieldValue.serverTimestamp(),
        completedAt: null,
        config: { maxRounds: 2, model: DEFAULT_MODEL },
        rounds: [],
        finalAnswer: null,
        confidence: null,
        errorMessage: null,
      })
    })
  } catch (err) {
    if (err instanceof Error && err.message === 'FREE_LIMIT_REACHED') {
      return NextResponse.json({ error: 'FREE_LIMIT_REACHED' }, { status: 402 })
    }
    throw err
  }

  return NextResponse.json({ panelId })
}
