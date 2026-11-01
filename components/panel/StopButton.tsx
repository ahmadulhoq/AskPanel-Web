'use client'

import { useState } from 'react'
import { Square } from 'lucide-react'

interface Props {
  panelId: string
  onStopped?: () => void
  // The debate finished on its own before the stop landed.
  onAlreadyFinished?: () => void
}

// Stops a running debate. The thread then shows "You stopped this debate." via the stream.
export function StopButton({ panelId, onStopped, onAlreadyFinished }: Props) {
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState('')

  async function stop() {
    setStopping(true)
    setError('')
    try {
      const res = await fetch(`/api/panels/${panelId}/stop`, { method: 'POST' })
      if (res.ok) {
        onStopped?.()
        return
      }
      if (res.status === 409) {
        onAlreadyFinished?.()
        setStopping(false)
        return
      }
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Could not stop the debate.')
      setStopping(false)
    } catch {
      setError('Network error. Please try again.')
      setStopping(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={stop}
        disabled={stopping}
        className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
      >
        <Square className="h-2.5 w-2.5 fill-current" />
        {stopping ? 'Stopping…' : 'Stop'}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </span>
  )
}
