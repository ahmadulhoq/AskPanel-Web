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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.turns, state.syntheses, state.finalAnswer])

  if (state.status === 'idle') {
    return <PanelSkeleton />
  }

  const roundNumbers = [...new Set([
    ...state.turns.map(t => t.round),
    ...state.syntheses.map(s => s.round),
  ])].sort((a, b) => a - b)

  return (
    <div className="space-y-8">
      {roundNumbers.map((round, roundIdx) => (
        <div key={round} className="space-y-6">
          {roundIdx > 0 && (
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">Round {round}</span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
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
    <div className="space-y-8 animate-pulse">
      {[{ w: 'w-20' }, { w: 'w-16' }, { w: 'w-24' }].map((item, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-7 w-7 flex-shrink-0 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className={`h-3.5 rounded bg-muted ${item.w}`} />
            <div className="h-4 rounded bg-muted" />
            <div className="h-4 rounded bg-muted w-5/6" />
            <div className="h-4 rounded bg-muted w-3/4" />
          </div>
        </div>
      ))}
    </div>
  )
}
