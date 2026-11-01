'use client'

import { Scale } from 'lucide-react'
import type { MessageRouting } from '@/types'

interface Props {
  routing: MessageRouting
  disabled: boolean
  onRun: () => void
  onAnswer: () => void
}

// The assistant thinks a message deserves the panel (free tier: it asks first — debates
// are what's metered).
export function ProposalCard({ routing, disabled, onRun, onAnswer }: Props) {
  return (
    <div className="rounded-2xl border bg-card px-4 py-3">
      <div className="flex items-center gap-2">
        <Scale className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">This looks worth debating</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {routing.mode === 'compare' ? 'Compare options' : 'Stress-test'}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{routing.reason}</p>
      <details className="mt-1.5 text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">What the panel would debate</summary>
        <p className="mt-1 whitespace-pre-wrap">{routing.question}</p>
      </details>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRun}
          disabled={disabled}
          className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Run the panel
        </button>
        <button
          type="button"
          onClick={onAnswer}
          disabled={disabled}
          className="rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          Just answer
        </button>
        <span className="text-xs text-muted-foreground">Running it uses one of your debates.</span>
      </div>
    </div>
  )
}
