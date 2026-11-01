import { PERSONA_MAP } from '@/lib/agents/personas'
import type { DebateSettings } from '@/types'

export const DEFAULT_DEBATE_SETTINGS: DebateSettings = { persona: 'general', maxRounds: 2, mode: 'critique' }

// Untrusted settings from a request → a known persona key ('custom' allowed), 1–3 rounds
// (critique mode only) and a mode. Tier limits are applied by createPanel.
export function sanitizeDebateSettings(input: unknown): DebateSettings {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const persona = typeof o.persona === 'string' && (o.persona === 'custom' || PERSONA_MAP[o.persona])
    ? o.persona
    : DEFAULT_DEBATE_SETTINGS.persona
  const rounds = typeof o.maxRounds === 'number' && Number.isFinite(o.maxRounds)
    ? Math.trunc(o.maxRounds)
    : DEFAULT_DEBATE_SETTINGS.maxRounds
  return { persona, maxRounds: Math.min(Math.max(rounds, 1), 3), mode: o.mode === 'compare' ? 'compare' : 'critique' }
}
