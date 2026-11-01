'use client'

import { useState } from 'react'
import { Check, Copy, Link2, Share2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Props {
  panelId: string
  initialIsPublic: boolean
  // A debate in a conversation: say what the link does and doesn't show.
  inConversation: boolean
  // 'chip': the small text button in a chat debate's header; 'button': the panel page's.
  look?: 'chip' | 'button'
  // The public page shows finished debates only.
  finished?: boolean
}

const linkFor = (panelId: string) => `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/p/${panelId}`

// Share one debate (BL-049): confirm, then a link to copy, with Stop sharing. Shared
// debates are readable by anyone with the link at /p/[panelId].
export function ShareDebateButton({ panelId, initialIsPublic, inConversation, look = 'button', finished = true }: Props) {
  const [isPublic, setIsPublic] = useState(initialIsPublic)
  // Fresh data from the server (e.g. shared from the panel page, then back to the chat).
  const [seen, setSeen] = useState(initialIsPublic)
  if (seen !== initialIsPublic) {
    setSeen(initialIsPublic)
    setIsPublic(initialIsPublic)
  }
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  async function setSharing(next: boolean) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/panels/${panelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      setIsPublic(next)
      if (!next) setOpen(false)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(linkFor(panelId))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard denied: the link is selectable in the field.
    }
  }

  const label = isPublic ? 'Shared' : 'Share'
  return (
    <>
      {look === 'chip' ? (
        <button
          type="button"
          onClick={() => { setError(''); setOpen(true) }}
          aria-label={isPublic ? 'Sharing options' : 'Share debate'}
          className="flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {isPublic ? <Link2 className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          {label}
        </button>
      ) : (
        <Button variant="outline" size="sm" onClick={() => { setError(''); setOpen(true) }} aria-label={isPublic ? 'Sharing options' : 'Share debate'}>
          {isPublic ? <Link2 className="mr-1.5 h-3.5 w-3.5" /> : <Share2 className="mr-1.5 h-3.5 w-3.5" />}
          {label}
        </Button>
      )}
      <Dialog open={open} onOpenChange={(o) => !saving && setOpen(o)}>
        <DialogContent>
          {isPublic ? (
            <>
              <DialogHeader>
                <DialogTitle>Anyone with the link can read this debate</DialogTitle>
                <DialogDescription>
                  The question, the debate and the verdict.
                  {inConversation && ' The rest of your conversation stays private.'}
                  {!finished && ' The link works once the debate has finished.'}
                </DialogDescription>
              </DialogHeader>
              <div className="flex gap-2">
                <Input readOnly value={linkFor(panelId)} aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
                <Button onClick={copy} className="shrink-0">
                  {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setSharing(false)} disabled={saving}>
                  {saving ? 'Stopping…' : 'Stop sharing'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Share this debate?</DialogTitle>
                <DialogDescription>
                  Anyone with the link will be able to read the question, the debate and the verdict.
                  {inConversation && ' The debate may mention things you told the assistant earlier; the rest of your conversation stays private.'}
                  {' '}You can stop sharing at any time.
                </DialogDescription>
              </DialogHeader>
              {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
                <Button onClick={() => setSharing(true)} disabled={saving}>
                  {saving ? 'Creating…' : 'Create link'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
