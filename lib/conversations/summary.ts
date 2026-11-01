import { getAnthropicClient, LIGHT_MODEL } from '@/lib/anthropic'
import { adminDb } from '@/lib/firebase/admin'
import { summaryBacklog, transcriptLine, type SeqMessage } from './context'
import { conversationRef } from './store'
import type { ConversationDoc } from '@/types'

// The summary rides on top of the reply budget; keep it bounded.
const MAX_SUMMARY_CHARS = 4_000

interface SummaryInput {
  // Recent messages, oldest first, as the reply route loaded them plus the new pair.
  history: SeqMessage[]
  summary: string | null
  summarizedThroughSeq: number
}

const SUMMARY_SYSTEM = `You maintain the running summary of a conversation between a user and AskPanel's assistant, so the assistant can keep helping after older messages drop out of its context.

Rewrite the existing summary to also cover the new messages. Keep: the user's goals, constraints, numbers, names, decisions made, open questions, and every panel verdict's conclusion with its confidence. Drop pleasantries and repetition. Write compact plain prose or short bullets, at most 300 words. Output only the summary.`

// Folds messages that have left the reply window into the conversation's rolling summary
// (spec §5). Called after a reply is saved, with the messages the route already loaded, so
// the usual case (nothing to fold) costs no reads. Best effort: never throws.
export async function updateSummary(cid: string, input: SummaryInput): Promise<void> {
  try {
    const { history, summary: previous, summarizedThroughSeq: through } = input
    const backlog = summaryBacklog(history, through)
    if (!backlog.length) return
    const ref = conversationRef(cid)

    const transcript = backlog.map(transcriptLine).filter(Boolean).join('\n')
    const res = await getAnthropicClient().messages.create({
      model: LIGHT_MODEL,
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      system: [{ type: 'text', text: SUMMARY_SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{
        role: 'user',
        content: `Existing summary:\n${previous ?? '(none yet)'}\n\nNew messages:\n${transcript}`,
      }],
    })
    const text = res.content
      .map((block) => (block.type === 'text' ? block.text : ''))
      .join('')
      .trim()
      .slice(0, MAX_SUMMARY_CHARS)
    if (!text) return

    // Only apply it if no other update landed meanwhile (two replies finishing together).
    await adminDb().runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data() as ConversationDoc | undefined
      if ((current?.summarizedThroughSeq ?? 0) !== through) return
      tx.update(ref, { summary: text, summarizedThroughSeq: backlog.at(-1)!.seq })
    })
  } catch (err) {
    console.error('[conversations] summary update failed', cid, err)
  }
}
