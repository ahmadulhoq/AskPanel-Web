'use client'

import { Input } from '@/components/ui/input'
import { MAX_OPTION_CHARS, PROPOSER_COUNT, sanitizeOptions } from '@/lib/agents/compareState'

export const EMPTY_OPTIONS = ['', '', '']
// Stored options back into the three fields.
export const toFields = (options: string[]) => [...options, ...EMPTY_OPTIONS].slice(0, PROPOSER_COUNT)

// The options to compare (BL-051): two or three, or none to let the panel take them from
// the question. Sent with the next compare debate only.
export function CompareOptionsInput({ value, onChange, tier }: {
  value: string[]
  onChange: (value: string[]) => void
  tier: 'free' | 'pro'
}) {
  const set = (i: number, text: string) => onChange(value.map((v, j) => (j === i ? text : v)))
  return (
    <div className="mb-3">
      <p className="mb-1.5 text-xs font-medium">Options to compare <span className="font-normal text-muted-foreground">(optional)</span></p>
      <div className="space-y-1.5">
        {value.map((v, i) => (
          <Input
            key={i}
            value={v}
            maxLength={MAX_OPTION_CHARS}
            onChange={(e) => set(i, e.target.value)}
            placeholder={i < 2 ? `Option ${i + 1}` : 'Option 3 (optional)'}
            aria-label={`Option ${i + 1}`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Name two or three, or leave empty to let the panel take them from your question.
        {tier === 'pro'
          ? ' Pro: each option is revised after the critique, before the judge decides.'
          : ' Pro adds a round where each option is revised after the critique.'}
      </p>
    </div>
  )
}

// The options worth sending — exactly what the server will use (same rules): at least two
// distinct ones, else none.
export const filledOptions = (value: string[]): string[] | undefined => sanitizeOptions(value) ?? undefined
