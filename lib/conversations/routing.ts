import type { MessageRouting } from '@/types'

// Checks and normalises the tool input. Null if unusable (the reply then falls back to text).
export function parseRouting(input: unknown): MessageRouting | null {
  if (!input || typeof input !== 'object') return null
  const o = input as Record<string, unknown>
  const question = typeof o.question === 'string' ? o.question.trim().slice(0, 2000) : ''
  const reason = typeof o.reason === 'string' ? o.reason.trim().slice(0, 300) : ''
  if (question.length < 10) return null
  const options = Array.isArray(o.options)
    ? o.options.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()).slice(0, 3)
    : []
  const mode = o.mode === 'compare' ? 'compare' : 'critique'
  // Named options go into the question, where the compare proposers look for them.
  const withOptions = mode === 'compare' && options.length && !options.every((x) => question.includes(x))
    ? `${question}\n\nOptions to compare: ${options.join('; ')}.`
    : question
  return { mode, question: withOptions, reason: reason || 'This looks worth stress-testing.' }
}
