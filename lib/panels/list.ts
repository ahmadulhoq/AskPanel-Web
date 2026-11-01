import { FieldPath, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { PERSONA_MAP } from '@/lib/agents/personas'
import type { PanelDoc, PanelSummary } from '@/types'

export const PANEL_PAGE_SIZE = 20

export interface PanelPage {
  panels: PanelSummary[]
  // Opaque cursor for the next page (null when there is none).
  next: string | null
}

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

// Cursor = the last panel's exact createdAt (seconds, nanoseconds) and id, so paging keeps
// working even if that panel is deleted in the meantime.
const encodeCursor = (createdAt: Timestamp, id: string) => `${createdAt.seconds}.${createdAt.nanoseconds}.${id}`
function decodeCursor(cursor: string): [Timestamp, string] | null {
  const m = /^(\d{1,12})\.(\d{1,9})\.([A-Za-z0-9_-]{1,64})$/.exec(cursor)
  return m ? [new Timestamp(Number(m[1]), Number(m[2])), m[3]] : null
}

// One page of the user's panels, newest first.
export async function listPanels(uid: string, cursor?: string): Promise<PanelPage> {
  let query = adminDb()
    .collection('panels')
    .where('userId', '==', uid)
    .orderBy('createdAt', 'desc')
    .orderBy(FieldPath.documentId(), 'desc')
  if (cursor) {
    const after = decodeCursor(cursor)
    if (!after) return { panels: [], next: null }
    query = query.startAfter(...after)
  }
  const snap = await query.limit(PANEL_PAGE_SIZE + 1).get()
  const docs = snap.docs.slice(0, PANEL_PAGE_SIZE)
  const last = docs.at(-1)
  const lastCreated = last?.data().createdAt as Timestamp | undefined
  return {
    panels: docs.map((d) => toPanelSummary(d.id, d.data() as PanelDoc)),
    next: snap.docs.length > PANEL_PAGE_SIZE && last && lastCreated ? encodeCursor(lastCreated, last.id) : null,
  }
}
