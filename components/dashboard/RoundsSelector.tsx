'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { PaywallDialog } from '@/components/panel/PaywallDialog'

interface Props {
  value: number
  onChange: (value: number) => void
  tier: 'free' | 'pro'
}

const OPTIONS = [
  { rounds: 1, label: '1', proOnly: false },
  { rounds: 2, label: '2', proOnly: false },
  { rounds: 3, label: '3', proOnly: true },
]

export function RoundsSelector({ value, onChange, tier }: Props) {
  const [showPaywall, setShowPaywall] = useState(false)

  return (
    <>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Debate rounds</span>
        <div className="flex gap-1">
          {OPTIONS.map(opt => {
            const locked = opt.proOnly && tier !== 'pro'
            const active = value === opt.rounds
            return (
              <button
                key={opt.rounds}
                type="button"
                onClick={() => (locked ? setShowPaywall(true) : onChange(opt.rounds))}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
                aria-label={
                  locked
                    ? '3 rounds (Pro only)'
                    : `${opt.rounds} round${opt.rounds !== 1 ? 's' : ''}`
                }
              >
                {locked && <Lock className="h-2.5 w-2.5" />}
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>
      <PaywallDialog open={showPaywall} onClose={() => setShowPaywall(false)} />
    </>
  )
}
