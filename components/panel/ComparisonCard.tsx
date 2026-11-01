import type { CompareJudgement } from '@/types'

interface Props {
  comparison: CompareJudgement
  // Option number → short name (from the proposal's heading).
  names: Record<number, string>
}

// The Judge's result in compare mode: who won, and how every option scored.
export function ComparisonCard({ comparison, names }: Props) {
  const name = (n: number) => names[n] ?? `Option ${n}`
  return (
    <div className="my-1 space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
          <span>✓</span>
          <span>Option {comparison.winner} wins</span>
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>
      {comparison.scores.length > 0 && (
        <ul className="mx-auto max-w-md space-y-1.5">
          {comparison.scores.map((s) => (
            <li key={s.option} className="text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`truncate ${s.option === comparison.winner ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {s.option}. {name(s.option)}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{s.score}/10</span>
              </div>
              <div className="mt-0.5 h-1 rounded-full bg-muted">
                <div
                  className={`h-1 rounded-full ${s.option === comparison.winner ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
                  style={{ width: `${s.score * 10}%` }}
                />
              </div>
              {s.summary && <p className="mt-0.5 text-muted-foreground">{s.summary}</p>}
            </li>
          ))}
        </ul>
      )}
      {comparison.reasoning && (
        <p className="px-8 text-center text-xs leading-relaxed text-muted-foreground">{comparison.reasoning}</p>
      )}
    </div>
  )
}
