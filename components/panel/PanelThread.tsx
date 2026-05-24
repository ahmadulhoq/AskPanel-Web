'use client'

import { useEffect, useRef } from 'react'
import { usePanel } from '@/hooks/usePanel'
import { AgentTurn } from './AgentTurn'
import { SynthesisCard } from './SynthesisCard'
import { FinalAnswer } from './FinalAnswer'

interface Props {
  panelId: string
}

export function PanelThread({ panelId }: Props) {
  const state = usePanel(panelId)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll as content streams in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.turns, state.syntheses, state.finalAnswer])

  if (state.status === 'idle') {
    return <PanelSkeleton />
  }

  // Interleave turns and syntheses in round order
  const roundNumbers = [...new Set([
    ...state.turns.map(t => t.round),
    ...state.syntheses.map(s => s.round),
  ])].sort((a, b) => a - b)

  return (
    <div className="space-y-4">
      {roundNumbers.map(round => (
        <div key={round} className="space-y-3">
          {state.turns
            .filter(t => t.round === round)
            .map((turn, i) => (
              <AgentTurn key={`${turn.agent}-${round}-${i}`} turn={turn} />
            ))}
          {state.syntheses
            .filter(s => s.round === round)
            .map(s => (
              <SynthesisCard key={`synth-${round}`} synthesis={s} />
            ))}
        </div>
      ))}

      {state.status === 'complete' && state.finalAnswer && state.confidence && (
        <FinalAnswer answer={state.finalAnswer} confidence={state.confidence} />
      )}

      {state.status === 'error' && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {state.errorMessage ?? 'An error occurred. Please try again.'}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="h-32 rounded-lg bg-muted" />
      ))}
    </div>
  )
}
