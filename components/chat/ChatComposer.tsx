'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Scale, SlidersHorizontal } from 'lucide-react'

const MAX_HEIGHT = 200

export type SendMode = 'reply' | 'debate'

interface Props {
  // Resolves true when the message was accepted, so the input can be cleared.
  onSubmit: (content: string, mode: SendMode) => Promise<boolean>
  disabled?: boolean
  placeholder?: string
  autoFocus?: boolean
  // Debate settings: a summary chip in the toolbar that toggles the settings panel.
  settings?: { label: string; panel: ReactNode }
}

export function ChatComposer({ onSubmit, disabled = false, placeholder, autoFocus = false, settings }: Props) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    resize()
  }, [text, resize])

  const busy = disabled || submitting
  const canSend = text.trim().length > 0 && !busy

  async function submit(mode: SendMode) {
    if (!canSend) return
    setSubmitting(true)
    try {
      if (await onSubmit(text.trim(), mode)) setText('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      {settings && showSettings && <div className="mb-2">{settings.panel}</div>}
      <div className="relative flex flex-col rounded-3xl border border-input bg-background shadow-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit('reply')
            }
          }}
          disabled={busy}
          placeholder={placeholder ?? 'Ask anything — use Debate when it deserves a panel.'}
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-base leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-60 md:text-sm"
        />
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-end gap-2 px-3 pb-2.5">
          {settings && (
            <button
              type="button"
              onClick={() => setShowSettings((s) => !s)}
              aria-expanded={showSettings}
              title="Debate panel settings"
              className="mr-auto flex h-8 min-w-0 items-center gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{settings.label}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => submit('debate')}
            disabled={!canSend}
            title="Run the debate panel on this message"
            className="flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Scale className="h-3.5 w-3.5" />
            Debate
          </button>
          <button
            type="button"
            onClick={() => submit('reply')}
            disabled={!canSend}
            aria-label="Send"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {submitting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
            ) : (
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
      <p className="mt-2 hidden px-2 text-xs text-muted-foreground sm:block">
        <kbd className="font-sans font-medium text-foreground/70">Enter</kbd> for a quick answer ·{' '}
        <span className="font-medium text-foreground/70">Debate</span> runs the panel on your message
      </p>
    </div>
  )
}
