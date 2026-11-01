import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import type { PanelMode } from '@/types'

// Spec §4 instrumentation: every coordinator decision and every user override, so the
// override rate (the routing-quality metric) can be measured. No message text is stored.
export type RoutingEvent =
  | 'answer'          // coordinator answered directly
  | 'debate'          // coordinator started a debate (Pro)
  | 'propose'         // coordinator proposed a debate (free)
  | 'run_proposal'    // user ran a proposed debate
  | 'just_answer'     // user overrode a debate/proposal with a direct answer
  | 'debate_this'     // user escalated a direct answer
  | 'debate_button'   // user asked for a debate up front

export function logRouting(uid: string, cid: string, messageId: string, event: RoutingEvent, mode: PanelMode | null = null) {
  adminDb()
    .collection('routingEvents')
    .add({ uid, cid, messageId, event, mode, at: FieldValue.serverTimestamp() })
    .catch((err) => console.error('[routing] could not log', event, err))
}
