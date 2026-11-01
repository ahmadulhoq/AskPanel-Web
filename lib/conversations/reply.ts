import type Anthropic from '@anthropic-ai/sdk'
import { getAnthropicClient, DEFAULT_MODEL } from '@/lib/anthropic'
import { parseRouting } from './routing'
import type { MessageRouting } from '@/types'

// Both system prompts are cached (cost-critical, same as the debate agents).

const PANEL = `AskPanel also has a debate panel: in "critique" mode a Respondent proposes an answer, a Critic stress-tests it and a Synthesizer delivers a verdict with a confidence level, over up to three rounds; in "compare" mode three proposers each argue for a different option, a Critic tests them and a Judge picks the winner. Debates take a minute or two.

Messages in square brackets such as "[Panel verdict — …]" are the results of debates earlier in this conversation. Treat them as conclusions the user has already reached, and build on them. A "[Summary of the earlier conversation]" block condenses messages that are no longer shown in full; rely on it for earlier details.`

// Spec §4: the reply model is the coordinator. It answers, or calls convene_panel.
const COORDINATOR_SYSTEM = `You are AskPanel's assistant. AskPanel helps people think through decisions and plans.

Answer the user's messages directly and concisely, in clean markdown. Ask a short clarifying question when the request is genuinely ambiguous.

${PANEL}

You decide when a message deserves the panel. Call the convene_panel tool — and write nothing else — when the user needs judgment that benefits from being stress-tested:
- a decision, a plan, or a recommendation with real trade-offs ("what should I do", "is this a good idea");
- evaluating a proposal, strategy or argument;
- choosing between alternatives (use mode "compare", and list the options if the user named them);
- an explicit request to debate or get a second opinion.
Do NOT call it for: clarifying questions, rewording or editing, factual lookups, explanations, summaries, small talk, or follow-ups that an existing panel verdict already answers. When in doubt and the stakes are low, just answer.

When you call it, write the question as a self-contained restatement that includes every relevant fact, goal and constraint from the conversation, because the panel sees only that question and a short brief. Give a one-line reason the user will see.`

// "Just answer": the user chose a direct reply over the panel.
const ANSWER_SYSTEM = `You are AskPanel's assistant. AskPanel helps people think through decisions and plans.

The user asked for a direct answer to their last message rather than a panel debate. Give your best answer directly and concisely, in clean markdown, including a clear recommendation where one is asked for. Don't suggest a debate.

${PANEL}`

export const CONVENE_PANEL_TOOL: Anthropic.Tool = {
  name: 'convene_panel',
  description: 'Send the user\'s message to the debate panel instead of answering it directly.',
  input_schema: {
    type: 'object' as const,
    properties: {
      mode: {
        type: 'string',
        enum: ['critique', 'compare'],
        description: '"compare" when the user is choosing between alternatives; otherwise "critique".',
      },
      question: {
        type: 'string',
        description: 'Self-contained restatement of what the panel should decide, with all relevant context, goals and constraints.',
      },
      reason: {
        type: 'string',
        description: 'One short line for the user on why this deserves the panel, e.g. "This is a trade-off between runway and growth."',
      },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Compare mode: the alternatives, if the user named them.',
      },
    },
    required: ['mode', 'question', 'reason'],
    additionalProperties: false,
  },
  strict: true,
}

export type ReplyChunk = { type: 'text'; text: string } | { type: 'panel'; routing: MessageRouting }

// Streams a reply. With `allowPanel`, the model may instead call convene_panel: then any
// text it wrote is discarded by the caller and a single 'panel' chunk ends the stream.
export async function* streamReply(
  messages: { role: 'user' | 'assistant'; content: string }[],
  { allowPanel = false }: { allowPanel?: boolean } = {},
): AsyncGenerator<ReplyChunk> {
  const stream = await getAnthropicClient().messages.create({
    model: DEFAULT_MODEL,
    // Thinking is on by default and counts toward max_tokens: leave room for it. Medium
    // effort keeps chat quick while the coordinator still weighs whether to debate.
    max_tokens: 8000,
    output_config: { effort: 'medium' },
    system: [{ type: 'text', text: allowPanel ? COORDINATOR_SYSTEM : ANSWER_SYSTEM, cache_control: { type: 'ephemeral' } }],
    ...(allowPanel ? { tools: [CONVENE_PANEL_TOOL], tool_choice: { type: 'auto' as const } } : {}),
    messages,
    stream: true,
  })
  let toolJson: string | null = null
  for await (const event of stream) {
    if (event.type === 'content_block_start' && event.content_block.type === 'tool_use' && event.content_block.name === CONVENE_PANEL_TOOL.name) {
      toolJson = ''
    } else if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta' && toolJson === null) yield { type: 'text', text: event.delta.text }
      else if (event.delta.type === 'input_json_delta' && toolJson !== null) toolJson += event.delta.partial_json
    }
  }
  if (toolJson !== null) {
    let input: unknown = null
    try {
      input = JSON.parse(toolJson || '{}')
    } catch {
      input = null
    }
    const routing = parseRouting(input)
    if (routing) {
      yield { type: 'panel', routing }
      return
    }
    // The model wanted the panel but the call was unusable: answer directly instead.
    yield* streamReply(messages, { allowPanel: false })
  }
}
