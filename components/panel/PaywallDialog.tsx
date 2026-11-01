'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  onClose: () => void
  /** 'limit': opened because the free debates ran out. 'feature': a locked Pro control was clicked. */
  reason?: 'limit' | 'feature'
}

const COPY = {
  limit: {
    title: 'You’ve used your free debates',
    description: 'Upgrade to Pro to keep going now, or come back when your free debates reset.',
  },
  feature: {
    title: 'That’s a Pro feature',
    description: 'Upgrade to Pro to unlock it.',
  },
} as const

export function PaywallDialog({ open, onClose, reason = 'limit' }: Props) {
  const [loading, setLoading] = useState(false)

  async function handleUpgrade() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/create-checkout', { method: 'POST' })
      const { url } = await res.json()
      window.location.href = url
    } catch {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{COPY[reason].title}</DialogTitle>
          <DialogDescription>{COPY[reason].description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-2xl font-bold">$15 <span className="text-base font-normal text-muted-foreground">/ month</span></p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>✓ 100 debates / month</li>
            <li>✓ All 5 personas</li>
            <li>✓ Up to 3 debate rounds</li>
            <li>✓ URL & text context injection</li>
            <li>✓ Export panels as Markdown</li>
          </ul>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleUpgrade} disabled={loading} className="flex-1">
            {loading ? 'Redirecting…' : 'Upgrade to Pro'}
          </Button>
          <Button variant="outline" onClick={onClose}>
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
