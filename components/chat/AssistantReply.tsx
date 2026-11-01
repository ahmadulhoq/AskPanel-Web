'use client'

import { useState } from 'react'
import { Streamdown } from 'streamdown'
import { Check, Copy, Scale } from 'lucide-react'
import type { MessageView } from '@/types'

interface Props {
  message: MessageView
  onDebate: (messageId: string) => void
  debateDisabled: boolean
}

export function AssistantReply({ message, onDebate, debateDisabled }: Props) {
  const [copied, setCopied] = useState(false)
  const streaming = message.status === 'streaming'
  const failed = message.status === 'error'

  async function copy() {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
        A
      </div>
      <div className="min-w-0 flex-1">
        {streaming && !message.content ? (
          <span className="inline-flex gap-0.5 pt-2" aria-label="Thinking">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </span>
        ) : (
          <Streamdown className="text-sm leading-relaxed" isAnimating={streaming}>
            {message.content}
          </Streamdown>
        )}

        {failed && (
          <p className="mt-1 text-xs text-destructive">
            {message.content ? 'This reply was cut off.' : 'This reply failed.'} Send your message again to retry.
          </p>
        )}

        {message.status === 'complete' && (
          <div className="mt-2 flex items-center gap-1">
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={() => onDebate(message.id)}
              disabled={debateDisabled}
              title="Run the debate panel on the question this answers"
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
            >
              <Scale className="h-3.5 w-3.5" />
              Debate this
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
