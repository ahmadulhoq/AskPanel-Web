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
}

export function PaywallDialog({ open, onClose }: Props) {
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
          <DialogTitle>You've used your 5 free panel runs</DialogTitle>
          <DialogDescription>
            Upgrade to Pro for unlimited runs, all personas, and file upload.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="text-2xl font-bold">$15 <span className="text-base font-normal text-muted-foreground">/ month</span></p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>✓ 100 panel runs / month</li>
            <li>✓ All personas</li>
            <li>✓ Custom personas</li>
            <li>✓ File upload (coming soon)</li>
            <li>✓ Panel history</li>
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
