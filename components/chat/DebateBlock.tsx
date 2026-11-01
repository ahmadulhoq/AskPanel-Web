'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Streamdown } from 'streamdown'
import { ChevronDown, ChevronUp, Scale } from 'lucide-react'
import { PanelThread } from '@/components/panel/PanelThread'
import { ConfidenceBadge } from '@/components/panel/ConfidenceBadge'
import { StopButton } from '@/components/panel/StopButton'
import { STOPPED_MESSAGE } from '@/lib/panels/constants'
import type { ConfidenceLevel, MessageView } from '@/types'

interface Props {
  panelId: string
  initial: MessageView['debate']
}

// A debate inside a conversation: live and expanded while it runs, collapsed to its
// verdict once it's done (expand to read the whole debate).
export function DebateBlock({ panelId, initial }: Props) {
  const [verdict, setVerdict] = useState<{ finalAnswer: string; confidence: ConfidenceLevel } | null>(
    initial?.status === 'complete' && initial.finalAnswer && initial.confidence
      ? { finalAnswer: initial.finalAnswer, confidence: initial.confidence }
      : null,
  )
  const [failure, setFailure] = useState<'stopped' | 'failed' | null>(
    initial?.status === 'error' && !verdict ? (initial.stopped ? 'stopped' : 'failed') : null,
  )
  const [open, setOpen] = useState(verdict === null && failure === null)
  const settled = verdict !== null || failure !== null

  const label = verdict
    ? 'Panel verdict'
    : failure === 'stopped' ? 'Debate stopped' : failure === 'failed' ? 'Panel debate failed' : 'Panel deliberating…'

  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3">
        <div className="flex items-center gap-2">
          <Scale className={`h-4 w-4 ${settled ? 'text-muted-foreground' : 'animate-pulse text-primary'}`} />
          <span className="whitespace-nowrap text-sm font-semibold">{label}</span>
          {verdict && <ConfidenceBadge level={verdict.confidence} />}
        </div>
        <div className="flex items-center gap-2">
          {!settled && <StopButton panelId={panelId} onStopped={() => setFailure('stopped')} />}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-expanded={open}
          >
            {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {open ? 'Hide debate' : 'Show debate'}
          </button>
        </div>
      </div>

      <div className="border-t px-4 py-4">
        {open ? (
          <PanelThread
            panelId={panelId}
            showFollowUp={false}
            canStop={false}
            onComplete={(finalAnswer, confidence) => setVerdict({ finalAnswer, confidence })}
            onError={(message) => setFailure(message === STOPPED_MESSAGE ? 'stopped' : 'failed')}
          />
        ) : verdict ? (
          <>
            <Streamdown className="text-sm leading-relaxed">{verdict.finalAnswer}</Streamdown>
            <Link href={`/panel/${panelId}`} className="mt-3 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
              Full transcript
            </Link>
          </>
        ) : failure ? (
          <p className="text-sm text-muted-foreground">
            {failure === 'stopped' ? STOPPED_MESSAGE : 'The debate failed.'} Show the debate to see how far it got or to try again.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">The panel is still deliberating. Show the debate to watch it live.</p>
        )}
      </div>
    </div>
  )
}
