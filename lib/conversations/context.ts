import type { MessageView } from '@/types'

export type ContextMessage = Pick<MessageView, 'role' | 'kind' | 'content' | 'status' | 'debate'>
export type SeqMessage = ContextMessage & Pick<MessageView, 'seq'>

interface ModelMessage {
  role: 'user' | 'assistant'
  content: string
}

// Quick replies see roughly the last 6k tokens of the conversation.
export const REPLY_BUDGET_CHARS = 24_000
// Debates get a short background brief; createPanel caps context at 4000 chars.
const DEBATE_BUDGET_CHARS = 3_500
// The reply window: the last 60 messages within REPLY_BUDGET_CHARS. Older messages are
// folded into the rolling summary.
export const REPLY_WINDOW_MESSAGES = 60
// Summarize once this much has left the window, to batch the calls. Until then those
// messages stay in the reply (see REPLY_SLACK_*), so nothing drops out of view meanwhile.
const BACKLOG_TRIGGER_CHARS = 3_000
const BACKLOG_TRIGGER_MESSAGES = 8
export const REPLY_SLACK_CHARS = BACKLOG_TRIGGER_CHARS
export const REPLY_SLACK_MESSAGES = BACKLOG_TRIGGER_MESSAGES
// How many recent messages the reply route loads: window + slack + margin for the summarizer.
export const REPLY_LOAD_MESSAGES = REPLY_WINDOW_MESSAGES + 20

function render(m: ContextMessage): string | null {
  if (m.kind === 'debate') {
    const d = m.debate
    if (!d) return null
    if (d.status === 'complete' && d.finalAnswer) {
      return `[Panel verdict — confidence: ${d.confidence ?? 'unknown'}]\n${d.finalAnswer}`
    }
    if (d.status === 'error' && d.stopped) return '[The user stopped the panel debate on this question — no verdict]'
    if (d.status === 'error') return '[The panel debate on this question failed — no verdict]'
    return '[A panel debate on this question is still running — no verdict yet]'
  }
  if (m.role === 'assistant' && m.status === 'error') return null
  return m.content.trim() || null
}

const summaryBlock = (summary: string) => `[Summary of the earlier conversation]\n${summary.trim()}`

// The conversation as Anthropic messages: alternating roles, starting with the user,
// trimmed from the oldest end to fit the budget (the newest turn is always kept). A rolling
// summary of older messages, if any, opens the first user turn. It is not counted against
// the budget, so the message window doesn't move when the summary changes length.
export function toModelMessages(
  history: ContextMessage[],
  maxChars = REPLY_BUDGET_CHARS,
  summary: string | null = null,
): ModelMessage[] {
  const intro = summary?.trim() ? summaryBlock(summary) : null
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
  if (intro) {
    if (kept[0]) kept[0].content = `${intro}\n\n${kept[0].content}`
    else kept.push({ role: 'user', content: intro })
  }
  return kept
}

// Where the reply window starts: the last REPLY_WINDOW_MESSAGES messages, trimmed from the
// oldest end to the character budget the way toModelMessages trims them.
function windowStart(history: ContextMessage[], maxChars: number): number {
  let start = Math.max(0, history.length - REPLY_WINDOW_MESSAGES)
  let used = 0
  for (let i = history.length - 1; i >= start; i--) {
    used += render(history[i])?.length ?? 0
    if (used > maxChars && i < history.length - 1) {
      start = i + 1
      break
    }
  }
  return start
}

// Messages that have fallen out of the reply window but aren't in the rolling summary yet.
// Empty until enough has built up to be worth a summarization call.
export function summaryBacklog<T extends SeqMessage>(
  history: T[],
  summarizedThroughSeq: number,
  maxChars = REPLY_BUDGET_CHARS,
): T[] {
  const backlog = history.slice(0, windowStart(history, maxChars)).filter((m) => m.seq > summarizedThroughSeq)
  const size = backlog.reduce((n, m) => n + (render(m)?.length ?? 0), 0)
  return size >= BACKLOG_TRIGGER_CHARS || backlog.length >= BACKLOG_TRIGGER_MESSAGES ? backlog : []
}

// What a quick reply sees besides the summary: the messages after it, up to the reply
// window plus the not-yet-summarized slack.
export function replyHistory<T extends SeqMessage>(history: T[], summarizedThroughSeq: number): T[] {
  return history
    .filter((m) => m.seq > summarizedThroughSeq)
    .slice(-(REPLY_WINDOW_MESSAGES + REPLY_SLACK_MESSAGES))
}

// One line per message, for the summarizer and the debate brief.
export function transcriptLine(m: ContextMessage): string | null {
  if (m.kind === 'debate') {
    return m.debate?.status === 'complete' && m.debate.finalAnswer
      ? `Panel verdict (confidence: ${m.debate.confidence ?? 'unknown'}): ${m.debate.finalAnswer}`
      : null
  }
  if (m.role === 'user') return m.content.trim() ? `User: ${m.content.trim()}` : null
  return m.status === 'complete' && m.content.trim() ? `Assistant: ${m.content.trim()}` : null
}

// A plain-text brief of the conversation so far, passed to a debate as background:
// the rolling summary (up to half the budget), then the most recent messages that fit.
export function debateContext(
  history: ContextMessage[],
  maxChars = DEBATE_BUDGET_CHARS,
  summary: string | null = null,
): string | null {
  const header = 'Earlier in this conversation:\n'
  let intro = ''
  if (summary?.trim()) {
    const room = Math.floor(maxChars / 2)
    const text = summary.trim()
    intro = `Summary: ${text.length > room ? `${text.slice(0, room - 1)}…` : text}\n`
  }
  const lines: string[] = []
  let used = header.length + intro.length
  for (let i = history.length - 1; i >= 0; i--) {
    const line = transcriptLine(history[i])
    if (!line) continue
    if (used + line.length + 1 > maxChars) break
    lines.unshift(line)
    used += line.length + 1
  }
  return lines.length || intro ? header + intro + lines.join('\n') : null
}
