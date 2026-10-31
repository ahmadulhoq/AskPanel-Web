import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { DEFAULT_MODEL } from '@/lib/anthropic'
import { reserveRun, FreeLimitReachedError } from '@/lib/billing/runs'

class RetryRejected extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

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
  const panelRef = db.collection('panels').doc(panelId)
  const userRef = db.collection('users').doc(user.uid)

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(panelRef)
      if (!snap.exists) throw new RetryRejected(404, 'Not found')
      const data = snap.data()!
      if (data.userId !== user.uid) throw new RetryRejected(403, 'Forbidden')
      if (data.status !== 'error') throw new RetryRejected(409, 'Panel is not in error state')

      // The failed run was refunded, so a retry counts as a new run.
      const { counted } = await reserveRun(tx, userRef, Date.now())

      // Start over: the stream route starts a fresh runner when the client reconnects.
      tx.update(panelRef, {
        status: 'queued',
        errorMessage: null,
        rounds: [],
        finalAnswer: null,
        confidence: null,
        completedAt: null,
        live: null,
        run: null,
        runCounted: counted,
        'config.model': DEFAULT_MODEL,
      })
    })
  } catch (err) {
    if (err instanceof RetryRejected) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    if (err instanceof FreeLimitReachedError) {
      return NextResponse.json(
        { error: "You've used your free runs for this month. Upgrade to Pro to retry." },
        { status: 402 },
      )
    }
    throw err
  }

  return NextResponse.json({ ok: true })
}
