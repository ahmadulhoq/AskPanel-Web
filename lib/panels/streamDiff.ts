import type { AgentRole, PanelDoc, SSEEvent } from '@/types'

export type PanelView = Pick<PanelDoc, 'status' | 'rounds' | 'finalAnswer' | 'confidence' | 'errorMessage' | 'live'>
  & Partial<Pick<PanelDoc, 'mode' | 'compare'>>

// What this stream has already told its client.
export interface StreamCursor {
  emitted: Set<string>
  live: { agent: AgentRole; round: number; index?: number; runId: string; sent: number } | null
  done: boolean
}

export const newCursor = (): StreamCursor => ({ emitted: new Set(), live: null, done: false })

// Converts the latest panel doc into the SSE events the client hasn't seen yet.
// The event shapes are the same ones the orchestrator used to stream directly.
export function diffPanel(cursor: StreamCursor, panel: PanelView): SSEEvent[] {
  if (cursor.done) return []
  if (panel.mode === 'compare') return diffCompare(cursor, panel)
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

  if (panel.live && !cursor.emitted.has(`${panel.live.round}:${panel.live.agent}`)) liveEvents(cursor, panel, events)
  return finish(cursor, panel, events)
}

// In-progress text of the turn being generated (the caller checks it isn't stored yet).
function liveEvents(cursor: StreamCursor, panel: PanelView, events: SSEEvent[]) {
  const live = panel.live
  if (!live || panel.status !== 'running') return
  const same = cursor.live?.agent === live.agent && cursor.live.round === live.round && cursor.live.index === live.index
  // A resumed run regenerates the turn from scratch; agent_start tells the client to reset it.
  const restarted = same && (cursor.live!.runId !== live.runId || live.content.length < cursor.live!.sent)
  const at = live.index !== undefined ? { index: live.index } : {}
  if (!same || restarted) {
    events.push({ type: 'agent_start', agent: live.agent, round: live.round, ...at })
    cursor.live = { agent: live.agent, round: live.round, ...at, runId: live.runId, sent: 0 }
  }
  const c = cursor.live!
  if (live.content.length > c.sent) {
    events.push({ type: 'agent_token', agent: live.agent, ...at, token: live.content.slice(c.sent) })
    c.sent = live.content.length
  }
}

function finish(cursor: StreamCursor, panel: PanelView, events: SSEEvent[]): SSEEvent[] {
  if (panel.status === 'complete' && panel.finalAnswer && panel.confidence) {
    events.push({ type: 'panel_complete', finalAnswer: panel.finalAnswer, confidence: panel.confidence })
    cursor.done = true
  } else if (panel.status === 'error') {
    events.push({ type: 'error', message: panel.errorMessage ?? 'The panel failed. Please try again.' })
    cursor.done = true
  }
  return events
}

// Compare mode: proposers (keyed by index), the critic, then the judge's result. All in
// round 1, so the client's thread shows them as one round.
const compareKey = (agent: AgentRole, index?: number) => (agent === 'proposer' ? `p${index}` : agent)

function diffCompare(cursor: StreamCursor, panel: PanelView): SSEEvent[] {
  const events: SSEEvent[] = []
  const compare = panel.compare
  const steps = [
    ...(compare?.proposals ?? []).map((p, index) => ({ agent: 'proposer' as const, index, content: p.content })),
    ...(compare?.critic ? [{ agent: 'critic' as const, index: undefined, content: compare.critic.content }] : []),
  ]
  for (const step of steps) {
    const key = compareKey(step.agent, step.index)
    if (cursor.emitted.has(key)) continue
    const wasLive = cursor.live?.agent === step.agent && cursor.live.index === step.index
    const at = step.index !== undefined ? { index: step.index } : {}
    if (!wasLive) events.push({ type: 'agent_start', agent: step.agent, round: 1, ...at })
    events.push({ type: 'agent_complete', agent: step.agent, round: 1, ...at, content: step.content })
    cursor.emitted.add(key)
    if (wasLive) cursor.live = null
  }

  const judgement = compare?.judgement
  if (judgement && !cursor.emitted.has('judge')) {
    events.push({ type: 'synthesis_start', round: 1 })
    events.push({ type: 'compare_result', ...judgement })
    cursor.emitted.add('judge')
  }

  if (panel.live && !cursor.emitted.has(compareKey(panel.live.agent, panel.live.index))) liveEvents(cursor, panel, events)
  return finish(cursor, panel, events)
}
