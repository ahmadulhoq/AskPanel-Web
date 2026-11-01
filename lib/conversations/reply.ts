import { getAnthropicClient, DEFAULT_MODEL } from '@/lib/anthropic'

// Cached system prompt (cost-critical, same as the debate agents).
const REPLY_SYSTEM = `You are AskPanel's assistant. AskPanel helps people think through decisions and plans.

Answer the user's messages directly and concisely, in clean markdown. Ask a short clarifying question when the request is genuinely ambiguous.

AskPanel also has a debate panel: a Respondent proposes an answer, a Critic stress-tests it, and a Synthesizer delivers a verdict with a confidence level, over up to three rounds. The user starts one with the "Debate" button. When a message is a decision, a plan, or a trade-off that would benefit from being stress-tested, give a brief, useful answer and suggest running a panel debate on it. You cannot start a debate yourself, and you must never claim that a debate has happened or invent its outcome.

Messages in square brackets such as "[Panel verdict — …]" are the results of debates earlier in this conversation. Treat them as conclusions the user has already reached, and build on them. A "[Summary of the earlier conversation]" block condenses messages that are no longer shown in full; rely on it for earlier details.`

// Streams a quick reply as text deltas.
export async function* streamReply(messages: { role: 'user' | 'assistant'; content: string }[]): AsyncGenerator<string> {
  const stream = await getAnthropicClient().messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 1500,
    system: [{ type: 'text', text: REPLY_SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages,
    stream: true,
  })
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text
    }
  }
}
