import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ConfidenceBadge } from './ConfidenceBadge'
import type { ConfidenceLevel } from '@/types'

interface Props {
  answer: string
  confidence: ConfidenceLevel
}

export function FinalAnswer({ answer, confidence }: Props) {
  return (
    <div className="mt-4 space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Panel Answer
          </span>
          <ConfidenceBadge level={confidence} />
        </div>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex gap-3">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          P
        </div>
        <div className="flex-1 min-w-0">
          <p className="mb-1.5 text-sm font-semibold">Panel</p>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
