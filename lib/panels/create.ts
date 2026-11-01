import { nanoid } from 'nanoid'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { DEFAULT_MODEL } from '@/lib/anthropic'
import { PERSONA_MAP } from '@/lib/agents/personas'
import { runPanelJob } from '@/lib/agents/runner'
import { reserveRun } from '@/lib/billing/runs'

export const MAX_CONTEXT_CHARS = 4000

export interface CreatePanelInput {
  uid: string
  question: string
  isPublic: boolean
  persona?: unknown
  maxRounds?: unknown
  userContext?: unknown
  parentPanelId?: unknown
  conversationId?: string
  messageId?: string
}

// Creates a debate panel and starts its run. Throws FreeLimitReachedError when a free user
// is out of runs. Used by the panel composer and by conversations.
export async function createPanel(input: CreatePanelInput): Promise<string> {
  const { uid, question } = input
  const db = adminDb()
  const userRef = db.collection('users').doc(uid)

  // 'custom' is allowed; unknown persona keys fall back to 'general'.
  const persona = typeof input.persona === 'string' && (input.persona === 'custom' || PERSONA_MAP[input.persona])
    ? input.persona
    : 'general'

  const userContext = typeof input.userContext === 'string' && input.userContext.trim()
    ? input.userContext.slice(0, MAX_CONTEXT_CHARS).trim()
    : null

  // Follow-up context from a parent panel (read-only, outside the transaction).
  let followUpContext: string | null = null
  let parentPanelId: string | null = null
  if (typeof input.parentPanelId === 'string' && input.parentPanelId) {
    const parent = (await db.collection('panels').doc(input.parentPanelId).get()).data()
    if (parent?.userId === uid && parent.status === 'complete' && parent.finalAnswer) {
      parentPanelId = input.parentPanelId
      followUpContext = `Context from a previous panel on a related question:\n${parent.finalAnswer}`
    }
  }
  const context = userContext && followUpContext
    ? `${userContext}\n\n${followUpContext}`
    : userContext ?? followUpContext

  const panelId = nanoid(12)
  await db.runTransaction(async (tx) => {
    const { tier, counted, userData } = await reserveRun(tx, userRef, Date.now())

    // Free → max 2 rounds, Pro → max 3.
    const limit = tier === 'pro' ? 3 : 2
    const requested = typeof input.maxRounds === 'number' ? Math.trunc(input.maxRounds) : 2
    const maxRounds = Math.min(Math.max(requested, 1), limit)

    // Copy the custom persona onto the panel so the run never needs the user doc.
    let customPersona: { label: string; respondentSystem: string; criticSystem: string } | null = null
    if (persona === 'custom' && tier === 'pro') {
      const cp = userData?.customPersona
      if (cp?.respondentSystem && cp?.criticSystem) {
        customPersona = { label: cp.label ?? 'Custom', respondentSystem: cp.respondentSystem, criticSystem: cp.criticSystem }
      }
    }

    tx.set(db.collection('panels').doc(panelId), {
      userId: uid,
      question: question.trim(),
      title: null,
      persona: persona === 'custom' && !customPersona ? 'general' : persona,
      customPersona,
      parentPanelId,
      conversationId: input.conversationId ?? null,
      messageId: input.messageId ?? null,
      context,
      status: 'queued',
      isPublic: input.isPublic,
      createdAt: FieldValue.serverTimestamp(),
      completedAt: null,
      config: { maxRounds, model: DEFAULT_MODEL },
      rounds: [],
      finalAnswer: null,
      confidence: null,
      errorMessage: null,
      runCounted: counted,
    })
  })

  // Start now rather than on first view, so a debate progresses even if nobody opens it
  // yet. Harmless if a viewer also starts it: the lease allows one runner.
  runPanelJob(panelId).catch((err) => console.error('[panels] runner crashed', panelId, err))
  return panelId
}
