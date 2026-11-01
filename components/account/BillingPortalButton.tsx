'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function BillingPortalButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleClick() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to open billing portal')
        return
      }
      const { url } = await res.json()
      window.location.href = url
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <Button onClick={handleClick} disabled={loading} variant="outline">
        {loading ? 'Opening…' : 'Manage billing'}
      </Button>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  )
}
