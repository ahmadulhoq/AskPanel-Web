'use client'

import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Check, Copy, Download } from 'lucide-react'
import { ConfidenceBadge } from './ConfidenceBadge'
import type { ConfidenceLevel } from '@/types'

interface Props {
  answer: string
  confidence: ConfidenceLevel
  panelId?: string
}

export function FinalAnswer({ answer, confidence, panelId }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(answer)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Panel</p>
            <div className="flex items-center gap-1">
              {panelId && (
                <a
                  href={`/api/panels/${panelId}/export`}
                  download
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Download panel as Markdown"
                >
                  <Download className="h-3.5 w-3.5" />
                  Export
                </a>
              )}
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Copy answer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
