'use client'

import { useState } from 'react'
import { Lock, Pencil, Plus } from 'lucide-react'
import { PERSONAS } from '@/lib/agents/personas'
import { PaywallDialog } from './PaywallDialog'
import { CustomPersonaEditor } from './CustomPersonaEditor'
import type { CustomPersona } from '@/types'

interface Props {
  persona: string
  onPersonaChange: (key: string) => void
  tier: 'free' | 'pro'
  customPersona: CustomPersona | null
  onCustomPersonaChange: (cp: CustomPersona) => void
}

export function PersonaSelector({ persona, onPersonaChange, tier, customPersona, onCustomPersonaChange }: Props) {
  const [showPaywall, setShowPaywall] = useState(false)
  const [showEditor, setShowEditor] = useState(false)

  function handleSelect(key: string, proOnly: boolean) {
    if (proOnly && tier !== 'pro') {
      setShowPaywall(true)
      return
    }
    onPersonaChange(key)
  }

  function handleCustomClick() {
    if (tier !== 'pro') {
      setShowPaywall(true)
      return
    }
    if (customPersona) {
      onPersonaChange('custom')
    } else {
      setShowEditor(true)
    }
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {PERSONAS.map(p => {
          const locked = p.proOnly && tier !== 'pro'
          const active = persona === p.key
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => handleSelect(p.key, p.proOnly)}
              title={p.description}
              className={[
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                locked ? 'opacity-60' : '',
              ].join(' ')}
            >
              {p.label}
              {locked && <Lock className="h-3 w-3" />}
            </button>
          )
        })}

        {/* Custom persona pill */}
        {customPersona ? (
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleCustomClick}
              title={`Custom: ${customPersona.label}`}
              className={[
                'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                persona === 'custom'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground',
              ].join(' ')}
            >
              {customPersona.label}
            </button>
            <button
              type="button"
              onClick={() => setShowEditor(true)}
              className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Edit custom persona"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleCustomClick}
            title={tier === 'pro' ? 'Create a custom persona' : 'Custom persona (Pro)'}
            className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            {tier !== 'pro' ? <Lock className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
            Custom
          </button>
        )}
      </div>

      <PaywallDialog open={showPaywall} onClose={() => setShowPaywall(false)} />
      <CustomPersonaEditor
        open={showEditor}
        onClose={() => setShowEditor(false)}
        initial={customPersona}
        onSaved={(cp) => {
          onCustomPersonaChange(cp)
          onPersonaChange('custom')
          setShowEditor(false)
        }}
      />
    </>
  )
}
