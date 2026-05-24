import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentTurnState } from '@/types'

const AGENT_META = {
  respondent: { label: 'Respondent', color: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800' },
  critic: { label: 'Critic', color: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800' },
}

interface Props {
  turn: AgentTurnState
}

export function AgentTurn({ turn }: Props) {
  const meta = AGENT_META[turn.agent]

  return (
    <div className={`rounded-lg border p-4 ${meta.color}`}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {meta.label}
        </span>
        <span className="text-xs text-muted-foreground">· Round {turn.round}</span>
        {turn.streaming && (
          <span className="inline-flex gap-0.5">
            <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
          </span>
        )}
      </div>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{turn.content}</ReactMarkdown>
      </div>
    </div>
  )
}
