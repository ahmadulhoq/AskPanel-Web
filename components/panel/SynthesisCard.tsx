import type { SynthesisState } from '@/types'

const DECISION_META = {
  continue: {
    label: 'Continuing debate',
    icon: '↻',
    pill: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400',
  },
  consensus: {
    label: 'Consensus reached',
    icon: '✓',
    pill: 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400',
  },
  contested: {
    label: 'Genuinely contested',
    icon: '⚑',
    pill: 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400',
  },
}

export function SynthesisCard({ synthesis }: { synthesis: SynthesisState }) {
  const meta = DECISION_META[synthesis.decision]

  return (
    <div className="my-1 space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${meta.pill}`}>
          <span>{meta.icon}</span>
          <span>{meta.label}</span>
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>
      {synthesis.reasoning && (
        <p className="text-center text-xs leading-relaxed text-muted-foreground px-8">
          {synthesis.reasoning}
        </p>
      )}
    </div>
  )
}
