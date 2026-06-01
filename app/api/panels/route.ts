import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { nanoid } from 'nanoid'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { DEFAULT_MODEL } from '@/lib/anthropic'
import { PERSONA_MAP } from '@/lib/agents/personas'

const FREE_RUN_LIMIT = 5
const RESET_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    question,
    isPublic = true,
    persona = 'general',
    parentPanelId,
    userContext,
    maxRounds: requestedRounds,
  } = body

  if (!question || typeof question !== 'string' || question.trim().length < 10) {
    return NextResponse.json({ error: 'Question must be at least 10 characters' }, { status: 400 })
  }

  // Validate persona key — 'custom' is allowed; unknown keys fall back to 'general'.
  const resolvedPersona = (persona === 'custom' || PERSONA_MAP[persona]) ? persona : 'general'

  // Sanitise userContext — max 4000 chars.
  const sanitisedUserContext =
    userContext && typeof userContext === 'string'
      ? userContext.slice(0, 4000).trim()
      : null

  const db = adminDb()
  const userRef = db.collection('users').doc(user.uid)

  // Resolve follow-up context from parent panel (outside transaction — read-only).
  let followUpContext: string | null = null
  let resolvedParentPanelId: string | null = null
  if (parentPanelId && typeof parentPanelId === 'string') {
    const parentSnap = await db.collection('panels').doc(parentPanelId).get()
    const parentData = parentSnap.data()
    if (
      parentSnap.exists &&
      parentData?.userId === user.uid &&
      parentData?.status === 'complete' &&
      parentData?.finalAnswer
    ) {
      resolvedParentPanelId = parentPanelId
      followUpContext = `Context from a previous panel on a related question:\n${parentData.finalAnswer}`
    }
  }

  // Merge user-provided context with follow-up context.
  let context: string | null = null
  if (sanitisedUserContext && followUpContext) {
    context = `${sanitisedUserContext}\n\n${followUpContext}`
  } else {
    context = sanitisedUserContext ?? followUpContext
  }

  const panelId = nanoid(12)
  const now = Date.now()

  try {
    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef)
      const userData = userSnap.data()

      const tier = userData?.subscription?.tier ?? 'free'
      let freeRunsUsed = userData?.freeRunsUsed ?? 0
      const resetAt = userData?.freeRunsResetAt?.toMillis() ?? 0

      // Monthly reset: if the reset window has passed, zero out the counter.
      if (tier !== 'pro' && (resetAt === 0 || now >= resetAt)) {
        freeRunsUsed = 0
        tx.update(userRef, {
          freeRunsUsed: 0,
          freeRunsResetAt: Timestamp.fromMillis(now + RESET_INTERVAL_MS),
        })
      }

      if (tier !== 'pro' && freeRunsUsed >= FREE_RUN_LIMIT) {
        throw new Error('FREE_LIMIT_REACHED')
      }

      // Validate maxRounds: free → max 2, pro → max 3.
      const maxRoundsLimit = tier === 'pro' ? 3 : 2
      const resolvedMaxRounds =
        typeof requestedRounds === 'number' && requestedRounds >= 1 && requestedRounds <= maxRoundsLimit
          ? requestedRounds
          : Math.min(requestedRounds ?? 2, maxRoundsLimit)

      // Resolve custom persona (Pro only) — copy prompts onto panel doc so orchestrator
      // doesn't need a second user-doc read and the panel is self-contained.
      let resolvedCustomPersona: { label: string; respondentSystem: string; criticSystem: string } | null = null
      if (resolvedPersona === 'custom' && tier === 'pro') {
        const cp = userData?.customPersona
        if (cp?.respondentSystem && cp?.criticSystem) {
          resolvedCustomPersona = { label: cp.label ?? 'Custom', respondentSystem: cp.respondentSystem, criticSystem: cp.criticSystem }
        }
      }
      // If custom was requested but no persona is saved yet, fall back to general.
      const finalPersona = resolvedPersona === 'custom' && !resolvedCustomPersona ? 'general' : resolvedPersona

      const panelRef = db.collection('panels').doc(panelId)
      tx.set(panelRef, {
        userId: user.uid,
        question: question.trim(),
        title: null,
        persona: finalPersona,
        customPersona: resolvedCustomPersona,
        parentPanelId: resolvedParentPanelId,
        context,
        status: 'queued',
        isPublic: isPublic === true,
        createdAt: FieldValue.serverTimestamp(),
        completedAt: null,
        config: { maxRounds: resolvedMaxRounds, model: DEFAULT_MODEL },
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
