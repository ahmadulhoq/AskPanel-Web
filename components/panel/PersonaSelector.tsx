'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { PERSONAS } from '@/lib/agents/personas'
import { PaywallDialog } from './PaywallDialog'

interface Props {
  persona: string
  onPersonaChange: (key: string) => void
  tier: 'free' | 'pro'
}

export function PersonaSelector({ persona, onPersonaChange, tier }: Props) {
  const [showPaywall, setShowPaywall] = useState(false)

  function handleSelect(key: string, proOnly: boolean) {
    if (proOnly && tier !== 'pro') {
      setShowPaywall(true)
      return
    }
    onPersonaChange(key)
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
      </div>

      <PaywallDialog open={showPaywall} onClose={() => setShowPaywall(false)} />
    </>
  )
}
