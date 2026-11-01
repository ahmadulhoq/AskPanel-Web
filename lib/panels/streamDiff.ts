import type { AgentRole, PanelDoc, SSEEvent } from '@/types'

export type PanelView = Pick<PanelDoc, 'status' | 'rounds' | 'finalAnswer' | 'confidence' | 'errorMessage' | 'live'>

// What this stream has already told its client.
export interface StreamCursor {
  emitted: Set<string>
  live: { agent: AgentRole; round: number; runId: string; sent: number } | null
  done: boolean
}

export const newCursor = (): StreamCursor => ({ emitted: new Set(), live: null, done: false })

// Converts the latest panel doc into the SSE events the client hasn't seen yet.
// The event shapes are the same ones the orchestrator used to stream directly.
export function diffPanel(cursor: StreamCursor, panel: PanelView): SSEEvent[] {
  if (cursor.done) return []
  const events: SSEEvent[] = []
  const rounds = [...(panel.rounds ?? [])].sort((a, b) => a.roundNumber - b.roundNumber)

  for (const r of rounds) {
    const n = r.roundNumber
    for (const agent of ['respondent', 'critic'] as const) {
      const turn = r[agent]
      const key = `${n}:${agent}`
      if (!turn || cursor.emitted.has(key)) continue
      const wasLive = cursor.live?.agent === agent && cursor.live.round === n
      if (!wasLive) events.push({ type: 'agent_start', agent, round: n })
      events.push({ type: 'agent_complete', agent, round: n, content: turn.content })
      cursor.emitted.add(key)
      if (wasLive) cursor.live = null
    }
    const synthKey = `${n}:synthesizer`
    if (r.synthesizer && !cursor.emitted.has(synthKey)) {
      const s = r.synthesizer
      events.push({ type: 'synthesis_start', round: n })
      events.push({
        type: 'synthesis_result',
        round: n,
        decision: s.decision,
        confidence: s.confidence,
        reasoning: s.reasoning,
        issuesFound: s.issuesFound ?? 0,
      })
      cursor.emitted.add(synthKey)
    }
  }

  const live = panel.live
  if (live && !cursor.emitted.has(`${live.round}:${live.agent}`) && panel.status === 'running') {
    const same = cursor.live?.agent === live.agent && cursor.live.round === live.round
    // A resumed run regenerates the turn from scratch; agent_start tells the client to reset it.
    const restarted = same && (cursor.live!.runId !== live.runId || live.content.length < cursor.live!.sent)
    if (!same || restarted) {
      events.push({ type: 'agent_start', agent: live.agent, round: live.round })
      cursor.live = { agent: live.agent, round: live.round, runId: live.runId, sent: 0 }
    }
    const c = cursor.live!
    if (live.content.length > c.sent) {
      events.push({ type: 'agent_token', agent: live.agent, token: live.content.slice(c.sent) })
      c.sent = live.content.length
    }
  }

  if (panel.status === 'complete' && panel.finalAnswer && panel.confidence) {
    events.push({ type: 'panel_complete', finalAnswer: panel.finalAnswer, confidence: panel.confidence })
    cursor.done = true
  } else if (panel.status === 'error') {
    events.push({ type: 'error', message: panel.errorMessage ?? 'The panel failed. Please try again.' })
    cursor.done = true
  }
  return events
}
