'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp } from 'lucide-react'

interface Props {
  parentPanelId: string
  parentPersona: string
}

const MAX_HEIGHT = 160

export function FollowUpComposer({ parentPanelId, parentPersona }: Props) {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, MAX_HEIGHT)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? 'auto' : 'hidden'
  }, [])

  useEffect(() => { resize() }, [question, resize])

  const submit = useCallback(async () => {
    const trimmed = question.trim()
    if (!trimmed || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: trimmed,
          parentPanelId,
          persona: parentPersona,
          isPublic: true,
        }),
      })
      if (res.status === 402) {
        setError("You've used all your free runs. Upgrade to Pro to continue.")
        return
      }
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to start follow-up panel')
        return
      }
      const { panelId } = await res.json()
      router.push(`/panel/${panelId}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [question, loading, parentPanelId, parentPersona, router])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground">Ask a follow-up</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="relative flex flex-col rounded-3xl border border-input bg-background shadow-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40">
        <textarea
          ref={textareaRef}
          rows={1}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Drill deeper, challenge an assumption, or explore a different angle…"
          className="max-h-[160px] w-full resize-none bg-transparent px-4 pt-3.5 pb-12 text-base leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-60 md:text-sm"
        />
        <div className="absolute bottom-2.5 right-2.5">
          <button
            type="button"
            onClick={submit}
            disabled={!question.trim() || loading}
            aria-label="Submit follow-up"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {loading
              ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
              : <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            }
          </button>
        </div>
      </div>

      {error && <p className="mt-2 px-2 text-xs text-destructive">{error}</p>}
    </div>
  )
}
