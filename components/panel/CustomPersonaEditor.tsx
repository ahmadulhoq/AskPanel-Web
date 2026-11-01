'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { CustomPersona } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  initial: CustomPersona | null
  onSaved: (persona: CustomPersona) => void
}

const RESPONDENT_PLACEHOLDER = `You are a senior VC partner evaluating a startup pitch. Analyse the business model, market size, team strength, and competitive moat. Be specific and cite your reasoning. Acknowledge genuine uncertainty.`

const CRITIC_PLACEHOLDER = `You are a sceptical analyst. Challenge assumptions, identify risks, question TAM estimates, and probe for weak points in the argument. Be rigorous but fair — only raise issues that genuinely matter.`

export function CustomPersonaEditor({ open, onClose, initial, onSaved }: Props) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [respondentSystem, setRespondentSystem] = useState(initial?.respondentSystem ?? '')
  const [criticSystem, setCriticSystem] = useState(initial?.criticSystem ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Sync form when initial changes (e.g. user opens editor after saving)
  useEffect(() => {
    if (open) {
      setLabel(initial?.label ?? '')
      setRespondentSystem(initial?.respondentSystem ?? '')
      setCriticSystem(initial?.criticSystem ?? '')
      setError('')
    }
  }, [open, initial])

  async function handleSave() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/user/persona', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, respondentSystem, criticSystem }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save')
        return
      }
      const { customPersona } = await res.json()
      onSaved(customPersona)
      onClose()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const canSave =
    label.trim().length > 0 &&
    respondentSystem.trim().length >= 20 &&
    criticSystem.trim().length >= 20 &&
    !loading

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Custom persona</DialogTitle>
          <DialogDescription>
            Write your own Respondent and Critic system prompts. The panel will use these instead of a built-in persona.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Persona name
            </label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              maxLength={40}
              placeholder="e.g. VC Lens, Legal Eagle, Product Critic"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Respondent prompt
              <span className="ml-1 font-normal text-muted-foreground">— advocates for an answer</span>
            </label>
            <textarea
              rows={5}
              value={respondentSystem}
              onChange={e => setRespondentSystem(e.target.value)}
              maxLength={2000}
              placeholder={RESPONDENT_PLACEHOLDER}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs leading-relaxed outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
            <p className="mt-0.5 text-right text-xs text-muted-foreground">
              {respondentSystem.length}/2000
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Critic prompt
              <span className="ml-1 font-normal text-muted-foreground">— challenges the answer</span>
            </label>
            <textarea
              rows={5}
              value={criticSystem}
              onChange={e => setCriticSystem(e.target.value)}
              maxLength={2000}
              placeholder={CRITIC_PLACEHOLDER}
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs leading-relaxed outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />
            <p className="mt-0.5 text-right text-xs text-muted-foreground">
              {criticSystem.length}/2000
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={!canSave} className="flex-1">
              {loading ? 'Saving…' : 'Save persona'}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
