import type { MessageView } from '@/types'

export type ContextMessage = Pick<MessageView, 'role' | 'kind' | 'content' | 'status' | 'debate'>

interface ModelMessage {
  role: 'user' | 'assistant'
  content: string
}

// Quick replies see roughly the last 6k tokens of the conversation.
const REPLY_BUDGET_CHARS = 24_000
// Debates get a short background brief; createPanel caps context at 4000 chars.
const DEBATE_BUDGET_CHARS = 3_500

function render(m: ContextMessage): string | null {
  if (m.kind === 'debate') {
    const d = m.debate
    if (!d) return null
    if (d.status === 'complete' && d.finalAnswer) {
      return `[Panel verdict — confidence: ${d.confidence ?? 'unknown'}]\n${d.finalAnswer}`
    }
    if (d.status === 'error') return '[The panel debate on this question failed — no verdict]'
    return '[A panel debate on this question is still running — no verdict yet]'
  }
  if (m.role === 'assistant' && m.status === 'error') return null
  return m.content.trim() || null
}

// The conversation as Anthropic messages: alternating roles, starting with the user,
// trimmed from the oldest end to fit the budget (the newest turn is always kept).
export function toModelMessages(history: ContextMessage[], maxChars = REPLY_BUDGET_CHARS): ModelMessage[] {
  const merged: ModelMessage[] = []
  for (const m of history) {
    const content = render(m)
    if (!content) continue
    const last = merged.at(-1)
    if (last?.role === m.role) last.content += `\n\n${content}`
    else merged.push({ role: m.role, content })
  }

  const kept: ModelMessage[] = []
  let used = 0
  for (let i = merged.length - 1; i >= 0; i--) {
    const len = merged[i].content.length
    if (kept.length > 0 && used + len > maxChars) break
    kept.unshift(merged[i])
    used += len
  }
  while (kept[0]?.role === 'assistant') kept.shift()
  return kept
}

// A plain-text brief of the conversation so far, passed to a debate as background.
export function debateContext(history: ContextMessage[], maxChars = DEBATE_BUDGET_CHARS): string | null {
  const header = 'Earlier in this conversation:\n'
  const lines: string[] = []
  let used = header.length
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i]
    let line: string | null = null
    if (m.kind === 'debate') {
      if (m.debate?.status === 'complete' && m.debate.finalAnswer) line = `Panel verdict: ${m.debate.finalAnswer}`
    } else if (m.role === 'user') {
      line = m.content.trim() ? `User: ${m.content.trim()}` : null
    } else if (m.status === 'complete' && m.content.trim()) {
      line = `Assistant: ${m.content.trim()}`
    }
    if (!line) continue
    if (used + line.length + 1 > maxChars) break
    lines.unshift(line)
    used += line.length + 1
  }
  return lines.length ? header + lines.join('\n') : null
}
