import type { CompareJudgement, ConfidenceLevel, PanelCompare } from '@/types'

// Proposers per compare run when the user names no options (spec §7.3: 2–3; with 3 there's
// room for an option the user didn't name). Critic + Judge make it 5 model calls; a Pro
// revision round adds one call per option.
export const PROPOSER_COUNT = 3
export const MAX_OPTION_CHARS = 200

// Options the user typed (untrusted): trimmed, non-empty, distinct, at most 3 and
// MAX_OPTION_CHARS each. Fewer than 2 means none: the proposers choose (null).
export function sanitizeOptions(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null
  const seen = new Set<string>()
  const options = input
    .filter((o): o is string => typeof o === 'string')
    .map((o) => o.replace(/\s+/g, ' ').trim().slice(0, MAX_OPTION_CHARS))
    .filter((o) => o && !seen.has(o.toLowerCase()) && seen.add(o.toLowerCase()))
    .slice(0, PROPOSER_COUNT)
  return options.length >= 2 ? options : null
}

export const emptyCompare = (options: string[] | null = null, revise = false): PanelCompare =>
  ({ options, revise, proposals: [], critic: null, revisions: [], judgement: null })

// How many proposers (and revisions) a compare run has.
export const proposerCount = (compare: PanelCompare | null | undefined) => compare?.options?.length || PROPOSER_COUNT

export type CompareStep =
  | { step: 'proposer'; index: number }
  | { step: 'critic' }
  | { step: 'revision'; index: number }
  | { step: 'judge' }

// Where an interrupted compare run picks up, given what is stored.
export function compareResumePoint(compare: PanelCompare | null | undefined): CompareStep {
  const count = proposerCount(compare)
  const proposals = compare?.proposals?.length ?? 0
  if (proposals < count) return { step: 'proposer', index: proposals }
  if (!compare?.critic) return { step: 'critic' }
  const revisions = compare.revisions?.length ?? 0
  if (compare.revise && revisions < count) return { step: 'revision', index: revisions }
  return { step: 'judge' }
}

// The options as the judge sees them: revised versions when there was a revision round.
export const finalProposals = (compare: PanelCompare) =>
  (compare.revise && compare.revisions?.length ? compare.revisions : compare.proposals).map((p) => p.content)

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

// When a compare run starts to count for Stop: once all its options are in (the critic and
// judge only weigh them). Before that, a stopped free run is refunded.
export const compareRunCounts = (compare: PanelCompare | null | undefined) =>
  (compare?.proposals?.length ?? 0) >= proposerCount(compare)

