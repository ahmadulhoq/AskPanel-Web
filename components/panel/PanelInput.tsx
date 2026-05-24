'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { PaywallDialog } from './PaywallDialog'

export function PanelInput() {
  const router = useRouter()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (question.trim().length < 10) return

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/panels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
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
  }

  const charCount = question.trim().length

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Textarea
          placeholder="What question do you want the panel to deliberate on? Be specific — the more context you give, the better the debate."
          value={question}
          onChange={e => setQuestion(e.target.value)}
          rows={4}
          className="resize-none"
          disabled={loading}
        />
        <div className="flex items-center justify-between">
          <span className={`text-xs ${charCount < 10 ? 'text-muted-foreground' : 'text-muted-foreground'}`}>
            {charCount < 10 ? `${10 - charCount} more characters needed` : `${charCount} characters`}
          </span>
          <Button
            type="submit"
            disabled={loading || charCount < 10}
          >
            {loading ? 'Starting panel…' : 'Ask the panel'}
          </Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </form>

      <PaywallDialog open={showPaywall} onClose={() => setShowPaywall(false)} />
    </>
  )
}
