'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, Lock, Globe } from 'lucide-react'
import { PaywallDialog } from './PaywallDialog'
import { useState } from 'react'

const MIN_CHARS = 10
const MAX_TEXTAREA_HEIGHT = 200

interface Props {
  question: string
  onQuestionChange: (value: string) => void
  isPublic: boolean
  onIsPublicChange: (value: boolean) => void
}

export function PanelInput({ question, onQuestionChange, isPublic, onIsPublicChange }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden'
  }, [])

  useEffect(() => {
    resize()
  }, [question, resize])

  const submit = useCallback(async () => {
    const trimmed = question.trim()
    if (trimmed.length < MIN_CHARS || loading) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, isPublic }),
      })

      if (res.status === 402) {
        setShowPaywall(true)
        return
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to start panel')
        return
      }

      const { panelId } = await res.json()
      router.push(`/panel/${panelId}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [question, isPublic, loading, router])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    submit()
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const charCount = question.trim().length
  const canSubmit = charCount >= MIN_CHARS && !loading

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="relative flex flex-col rounded-3xl border border-input bg-background shadow-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
          <textarea
            ref={textareaRef}
            rows={1}
            value={question}
            onChange={e => onQuestionChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask the panel anything — the more context you give, the sharper the debate."
            className="max-h-[200px] w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-base leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-60 md:text-sm"
          />

          {/* Bottom toolbar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-2.5">
            <button
              type="button"
              onClick={() => onIsPublicChange(!isPublic)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={isPublic ? 'Panel is public — click to make private' : 'Panel is private — click to make public'}
            >
              {isPublic ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
              {isPublic ? 'Public' : 'Private'}
            </button>

            <button
              type="submit"
              disabled={!canSubmit}
              aria-label="Ask the panel"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
            >
              {loading ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              ) : (
                <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
              )}
            </button>
          </div>
        </div>

        <div className="mt-2 flex min-h-5 items-center justify-between px-2 text-xs text-muted-foreground">
          <span aria-live="polite">
            {error ? (
              <span className="text-destructive">{error}</span>
            ) : charCount > 0 && charCount < MIN_CHARS ? (
              `${MIN_CHARS - charCount} more character${MIN_CHARS - charCount !== 1 ? 's' : ''} needed`
            ) : (
              ''
            )}
          </span>
          <span className="hidden shrink-0 sm:inline">
            <kbd className="font-sans font-medium text-foreground/70">Enter</kbd> to send ·{' '}
            <kbd className="font-sans font-medium text-foreground/70">Shift + Enter</kbd> for a new line
          </span>
        </div>
      </form>

      <PaywallDialog open={showPaywall} onClose={() => setShowPaywall(false)} />
    </>
  )
}
