'use client'

import { useState } from 'react'
import { RotateCcw } from 'lucide-react'

interface Props {
  panelId: string
}

export function RetryButton({ panelId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRetry() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/panels/${panelId}/retry`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to retry')
        return
      }
      window.location.reload()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleRetry}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/20 disabled:opacity-60"
      >
        <RotateCcw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Retrying…' : 'Try again'}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
