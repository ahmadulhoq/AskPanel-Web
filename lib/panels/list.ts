import { adminDb } from '@/lib/firebase/admin'
import { PERSONA_MAP } from '@/lib/agents/personas'
import type { PanelDoc, PanelSummary } from '@/types'

export const PANEL_PAGE_SIZE = 20

function toPanelSummary(id: string, data: PanelDoc): PanelSummary {
  const personaLabel = data.persona === 'custom'
    ? (data.customPersona?.label ?? 'Custom')
    : data.persona !== 'general'
      ? (PERSONA_MAP[data.persona]?.label ?? data.persona)
      : null
  return {
    id,
    question: data.question,
    title: data.title ?? null,
    persona: data.persona,
    personaLabel,
    status: data.status,
    isPublic: data.isPublic,
    parentPanelId: data.parentPanelId ?? null,
    confidence: data.confidence ?? null,
  }
}

// One page of the user's panels, newest first, continuing after the panel `afterId`.
export async function listPanels(uid: string, afterId?: string): Promise<{ panels: PanelSummary[]; hasMore: boolean }> {
  const panels = adminDb().collection('panels')
  let query = panels.where('userId', '==', uid).orderBy('createdAt', 'desc')
  if (afterId) {
    const cursor = await panels.doc(afterId).get()
    if (!cursor.exists || cursor.data()?.userId !== uid) return { panels: [], hasMore: false }
    query = query.startAfter(cursor)
  }
  const snap = await query.limit(PANEL_PAGE_SIZE + 1).get()
  const docs = snap.docs.slice(0, PANEL_PAGE_SIZE)
  return {
    panels: docs.map((d) => toPanelSummary(d.id, d.data() as PanelDoc)),
    hasMore: snap.docs.length > PANEL_PAGE_SIZE,
  }
}
