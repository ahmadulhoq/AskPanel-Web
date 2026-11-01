'use client'

import type { PanelMode } from '@/types'

const MODES: { value: PanelMode; label: string; hint: string }[] = [
  { value: 'critique', label: 'Stress-test', hint: 'One answer, challenged by a critic over rounds' },
  { value: 'compare', label: 'Compare options', hint: 'Options compete; a judge picks the winner' },
]

// Which kind of debate to run.
export function ModeSelector({ value, onChange }: { value: PanelMode; onChange: (mode: PanelMode) => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Debate type">
      {MODES.map((m) => {
        const active = value === m.value
        return (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={m.hint}
            onClick={() => onChange(m.value)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {m.label}
          </button>
        )
      })}
      <span className="text-xs text-muted-foreground">{MODES.find((m) => m.value === value)?.hint}</span>
    </div>
  )
}
