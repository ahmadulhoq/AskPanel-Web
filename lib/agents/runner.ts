import { nanoid } from 'nanoid'
import { adminDb } from '@/lib/firebase/admin'
import { refundRun } from '@/lib/billing/runs'
import { runPanel } from './orchestrator'
import { generatePanelTitle } from './title'
import type { AgentRole, PanelDoc } from '@/types'

const LEASE_TTL_MS = 60_000
const HEARTBEAT_MS = 15_000
// Firestore sustains about one write per second per document.
const LIVE_FLUSH_MS = 1_000

// Runs a panel to completion, independent of any browser connection. Safe to call from
// every viewer: it does nothing while another runner holds a live lease, and resumes after
// the last stored step if a previous runner died. Never throws.
export async function runPanelJob(panelId: string): Promise<void> {
  const db = adminDb()
  const ref = db.collection('panels').doc(panelId)
  const leaseId = nanoid(12)

  let panel: PanelDoc | null
  try {
    panel = await db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data() as PanelDoc | undefined
      if (!data || data.status === 'complete' || data.status === 'error') return null
      if (data.run && Date.now() - data.run.heartbeatAt < LEASE_TTL_MS) return null
      tx.update(ref, { run: { id: leaseId, heartbeatAt: Date.now() } })
      return data
    })
  } catch (err) {
    console.error('[runner] could not acquire lease', panelId, err)
    return
  }
  if (!panel) return

  let lost = false
  const heartbeat = setInterval(() => {
    db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data() as PanelDoc | undefined
      if (data?.run?.id !== leaseId) {
        lost = true
        return
      }
      tx.update(ref, { 'run.heartbeatAt': Date.now() })
    }).catch((err) => console.error('[runner] heartbeat failed', panelId, err))
  }, HEARTBEAT_MS)

  let live: { agent: AgentRole; round: number; content: string } | null = null
  let lastFlush = 0
  const flushLive = async (force: boolean) => {
    if (!live || lost || (!force && Date.now() - lastFlush < LIVE_FLUSH_MS)) return
    lastFlush = Date.now()
    await ref.update({ live: { ...live, runId: leaseId } })
  }

  try {
    const run = runPanel({
      panelId,
      question: panel.question,
      config: panel.config,
      persona: panel.persona ?? 'general',
      context: panel.context ?? undefined,
      customPersona: panel.customPersona ?? undefined,
      rounds: panel.rounds ?? [],
      leaseId,
    })

    for await (const event of run) {
      if (lost) break
      switch (event.type) {
        case 'agent_start':
          live = { agent: event.agent, round: event.round, content: '' }
          await flushLive(true)
          break
        case 'agent_token':
          if (live) {
            live.content += event.token
            await flushLive(false)
          }
          break
        case 'agent_complete':
          // The orchestrator stores the finished turn; viewers pick it up from the round.
          live = null
          break
        case 'panel_complete':
          await generatePanelTitle(panelId, panel.question)
          break
        case 'error':
          await refundRun(panelId).catch((err) => console.error('[runner] refund failed', panelId, err))
          break
      }
    }
  } catch (err) {
    console.error('[runner] run failed', panelId, err)
  } finally {
    clearInterval(heartbeat)
    // Release the lease so a retry or reconnect doesn't have to wait for it to expire.
    await db
      .runTransaction(async (tx) => {
        const data = (await tx.get(ref)).data() as PanelDoc | undefined
        if (data?.run?.id === leaseId) tx.update(ref, { run: null, live: null })
      })
      .catch(() => {})
  }
}
