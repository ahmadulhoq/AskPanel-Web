import { optionName } from '@/lib/agents/compareState'
import { AgentTurn } from './AgentTurn'
import { SynthesisCard } from './SynthesisCard'
import { ComparisonCard } from './ComparisonCard'
import type { PanelState } from '@/types'

// The debate itself — agent turns grouped by round, with each round's synthesis, or in
// compare mode the options and the critique, the revised options (Pro, round 2) and the
// judge's comparison. Shared by the live
// thread (PanelThread) and the public share page.
export function ThreadView({ state }: { state: Pick<PanelState, 'status' | 'turns' | 'syntheses' | 'comparison'> }) {
  const roundNumbers = [...new Set([
    ...state.turns.map(t => t.round),
    ...state.syntheses.map(s => s.round),
  ])].sort((a, b) => a - b)

  const compare = state.turns.some(t => t.agent === 'proposer')
  // Option names come from each proposer's latest version (revised, if there was a round 2).
  const names: Record<number, string> = {}
  for (const t of [...state.turns].sort((a, b) => a.round - b.round)) {
    if (t.agent === 'proposer' && !t.streaming) {
      const n = (t.index ?? 0) + 1
      names[n] = optionName(t.content, `Option ${n}`)
    }
  }
  const lastRound = roundNumbers.at(-1)
  const critiqueDone = state.turns.some(t => t.agent === 'critic' && !t.streaming)
  const judging = compare && critiqueDone && !state.comparison && state.status === 'running' && !state.turns.some(t => t.streaming)

  return (
    <>
      {roundNumbers.map((round, roundIdx) => (
        <div key={round} className="space-y-6">
          {roundIdx > 0 && (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">{compare ? 'Revised after the critique' : `Round ${round}`}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          {state.turns
            .filter(t => t.round === round)
            .map((turn, i) => {
              // For the Critic, issuesFound comes from the same-round Synthesizer. It's null
              // during a live run and appears once synthesis_result arrives.
              const sameSynthesis = turn.agent === 'critic'
                ? state.syntheses.find(s => s.round === round)
                : undefined
              return (
                <AgentTurn
                  key={`${turn.agent}-${round}-${turn.index ?? i}`}
                  turn={turn}
                  issuesFound={sameSynthesis?.issuesFound}
                  winner={turn.agent === 'proposer' && round === lastRound && state.comparison?.winner === (turn.index ?? 0) + 1}
                />
              )
            })}
          {state.syntheses
            .filter(s => s.round === round)
            .map(s => <SynthesisCard key={`synth-${round}`} synthesis={s} />)}
          {round === lastRound && state.comparison && <ComparisonCard comparison={state.comparison} names={names} />}
          {round === lastRound && judging && (
            <p className="animate-pulse text-center text-xs text-muted-foreground">The judge is weighing the options…</p>
          )}
        </div>
      ))}
    </>
  )
}
