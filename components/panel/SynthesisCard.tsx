import type { SynthesisState } from '@/types'

const DECISION_META = {
  continue: { label: 'Continuing debate', icon: '↻', color: 'text-amber-600 dark:text-amber-400' },
  consensus: { label: 'Consensus reached', icon: '✓', color: 'text-green-600 dark:text-green-400' },
  contested: { label: 'Genuinely contested', icon: '⚑', color: 'text-red-600 dark:text-red-400' },
}

export function SynthesisCard({ synthesis }: { synthesis: SynthesisState }) {
  const meta = DECISION_META[synthesis.decision]

  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-3">
      <span className={`mt-0.5 text-base ${meta.color}`}>{meta.icon}</span>
      <div>
        <p className={`text-xs font-semibold ${meta.color}`}>
          Synthesizer · Round {synthesis.round} · {meta.label}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{synthesis.reasoning}</p>
      </div>
    </div>
  )
}
