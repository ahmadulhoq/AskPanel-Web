'use client'

import { useEffect, useRef } from 'react'
import { usePanel, CONNECTION_LOST_MESSAGE } from '@/hooks/usePanel'
import { ThreadView } from './ThreadView'
import { FinalAnswer } from './FinalAnswer'
import { FollowUpComposer } from './FollowUpComposer'
import { RetryButton } from './RetryButton'
import { StopButton } from './StopButton'
import type { ConfidenceLevel } from '@/types'

interface Props {
  panelId: string
  persona?: string
  isPublic?: boolean
  // Inside a conversation the chat input replaces the follow-up box.
  showFollowUp?: boolean
  // Show a Stop button while the debate runs (off when the parent renders its own).
  canStop?: boolean
  onComplete?: (finalAnswer: string, confidence: ConfidenceLevel) => void
  onError?: (message: string) => void
}

export function PanelThread({
  panelId, persona = 'general', isPublic = true, showFollowUp = true, canStop = true, onComplete, onError,
}: Props) {
  const state = usePanel(panelId)

  // Report the outcome once, even if the parent passes new callbacks on every render.
  const reported = useRef(false)
  useEffect(() => {
    if (reported.current) return
    if (state.status === 'complete' && state.finalAnswer && state.confidence) {
      reported.current = true
      onComplete?.(state.finalAnswer, state.confidence)
    } else if (state.status === 'error' && state.errorMessage !== CONNECTION_LOST_MESSAGE) {
      // A lost connection is this page's problem, not the debate's: don't report it.
      reported.current = true
      onError?.(state.errorMessage ?? '')
    }
  }, [state.status, state.finalAnswer, state.confidence, state.errorMessage, onComplete, onError])

  if (state.status === 'idle') {
    return <PanelSkeleton />
  }

  return (
    <div className="space-y-8">
      <ThreadView state={state} />

      {canStop && state.status === 'running' && (
        <div className="flex justify-center">
          <StopButton panelId={panelId} />
        </div>
      )}

      {state.status === 'complete' && state.finalAnswer && state.confidence && (
        <>
          <FinalAnswer answer={state.finalAnswer} confidence={state.confidence} panelId={panelId} />
          {showFollowUp && (
            <FollowUpComposer parentPanelId={panelId} parentPersona={persona} parentIsPublic={isPublic} />
          )}
        </>
      )}

      {state.status === 'error' && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 space-y-3">
          <p className="text-sm text-destructive">
            {state.errorMessage ?? 'An error occurred. Please try again.'}
          </p>
          <RetryButton panelId={panelId} />
        </div>
      )}

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
