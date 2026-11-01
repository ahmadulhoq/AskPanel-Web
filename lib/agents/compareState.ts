import type { CompareJudgement, ConfidenceLevel, PanelCompare } from '@/types'

// Proposers per compare run (spec §7.3: 2–3; with 3 there's room for an option the user
// didn't name). Critic + Judge make it 5 model calls.
export const PROPOSER_COUNT = 3

export const emptyCompare = (): PanelCompare => ({ proposals: [], critic: null, judgement: null })

export type CompareStep = { step: 'proposer'; index: number } | { step: 'critic' } | { step: 'judge' }

// Where an interrupted compare run picks up, given what is stored.
export function compareResumePoint(compare: PanelCompare | null | undefined): CompareStep {
  const proposals = compare?.proposals?.length ?? 0
  if (proposals < PROPOSER_COUNT) return { step: 'proposer', index: proposals }
  if (!compare?.critic) return { step: 'critic' }
  return { step: 'judge' }
}

// A proposal's short name: its first markdown heading, without a leading "Option:" label.
export function optionName(content: string, fallback: string): string {
  const heading = /^#{1,6}\s+(.+)$/m.exec(content)?.[1]?.trim()
  const name = heading?.replace(/^option\s*\d*\s*[:.\-–—]\s*/i, '').replace(/\*\*/g, '').trim()
  return name ? name.slice(0, 80) : fallback
}

const CONFIDENCE: ConfidenceLevel[] = ['high', 'medium', 'low', 'contested']

// The Judge's tool input, checked and normalised: winner within 1..options, one score
// (1–10) per option at most, known confidence. Returns null if unusable.
export function parseJudgement(input: unknown, options: number): (CompareJudgement & { finalAnswer: string }) | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>
  const winner = Math.trunc(Number(o.winner))
  if (!(winner >= 1 && winner <= options)) return null
  const finalAnswer = typeof o.finalAnswer === 'string' ? o.finalAnswer.trim() : ''
  if (!finalAnswer) return null
  const seen = new Set<number>()
  const scores = (Array.isArray(o.scores) ? o.scores : [])
    .map((s) => s as Record<string, unknown>)
    .map((s) => ({
      option: Math.trunc(Number(s?.option)),
      score: Math.min(10, Math.max(1, Math.round(Number(s?.score)))),
      summary: typeof s?.summary === 'string' ? s.summary.trim() : '',
    }))
    .filter((s) => s.option >= 1 && s.option <= options && Number.isFinite(s.score) && !seen.has(s.option) && seen.add(s.option))
    .sort((a, b) => a.option - b.option)
  const confidence = CONFIDENCE.includes(o.confidence as ConfidenceLevel) ? (o.confidence as ConfidenceLevel) : 'medium'
  return { winner, scores, reasoning: typeof o.reasoning === 'string' ? o.reasoning.trim() : '', confidence, finalAnswer }
}
