'use client'

import { PersonaSelector } from '@/components/panel/PersonaSelector'
import { RoundsSelector } from '@/components/dashboard/RoundsSelector'
import { PERSONA_MAP } from '@/lib/agents/personas'
import type { CustomPersona, DebateSettings } from '@/types'

interface Props {
  tier: 'free' | 'pro'
  value: DebateSettings
  onChange: (value: DebateSettings) => void
  customPersona: CustomPersona | null
  onCustomPersonaChange: (persona: CustomPersona) => void
}

// Persona and rounds for debates started from a conversation.
export function DebateSettingsPanel({ tier, value, onChange, customPersona, onCustomPersonaChange }: Props) {
  return (
    <div className="rounded-2xl border bg-card px-4 pt-3 pb-1">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Debate panel</p>
      <PersonaSelector
        persona={value.persona}
        onPersonaChange={(persona) => onChange({ ...value, persona })}
        tier={tier}
        customPersona={customPersona}
        onCustomPersonaChange={onCustomPersonaChange}
      />
      <RoundsSelector value={value.maxRounds} onChange={(maxRounds) => onChange({ ...value, maxRounds })} tier={tier} />
    </div>
  )
}

export function debateSettingsLabel(value: DebateSettings, customPersona: CustomPersona | null): string {
  const persona = value.persona === 'custom'
    ? (customPersona?.label ?? 'Custom')
    : (PERSONA_MAP[value.persona]?.label ?? 'General')
  return `${persona} · ${value.maxRounds} round${value.maxRounds === 1 ? '' : 's'}`
}
