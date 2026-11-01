import { Streamdown } from 'streamdown'
import type { AgentTurnState } from '@/types'

const AGENT_META = {
  respondent: {
    label: 'Respondent',
    initial: 'R',
    avatar: 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300',
  },
  critic: {
    label: 'Critic',
    initial: 'C',
    avatar: 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300',
  },
  proposer: {
    label: 'Option',
    initial: 'O',
    avatar: 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-300',
  },
}

interface Props {
  turn: AgentTurnState
  issuesFound?: number
  // Compare mode: this proposer's option won.
  winner?: boolean
}

export function AgentTurn({ turn, issuesFound, winner = false }: Props) {
  const base = AGENT_META[turn.agent]
  const option = turn.agent === 'proposer' ? (turn.index ?? 0) + 1 : null
  const meta = option ? { ...base, label: `Option ${option}`, initial: String(option) } : base

  return (
    <div className="flex gap-3">
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${meta.avatar}`}>
        {meta.initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-sm font-semibold">{meta.label}</span>
          {winner && (
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
              Winner
            </span>
          )}
          {turn.agent === 'critic' && issuesFound != null && issuesFound > 0 && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              {issuesFound} issue{issuesFound !== 1 ? 's' : ''} found
            </span>
          )}
          {turn.streaming && (
            <span className="inline-flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </span>
          )}
        </div>
        <Streamdown className="text-sm leading-relaxed" isAnimating={turn.streaming}>
          {turn.content}
        </Streamdown>
      </div>
    </div>
  )
}
