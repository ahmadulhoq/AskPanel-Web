import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfidenceBadge } from './ConfidenceBadge'
import type { ConfidenceLevel } from '@/types'

interface Props {
  answer: string
  confidence: ConfidenceLevel
}

export function FinalAnswer({ answer, confidence }: Props) {
  return (
    <Card className="border-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Panel Answer</CardTitle>
          <ConfidenceBadge level={confidence} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  )
}
