import { getAnthropicClient, DEFAULT_MODEL } from '@/lib/anthropic'
import { adminDb } from '@/lib/firebase/admin'
import { REPLY_BUDGET_CHARS, summaryBacklog, transcriptLine } from './context'
import { conversationRef, loadMessages } from './store'
import type { ConversationDoc } from '@/types'

// How far back the summarizer looks for messages that left the reply window.
const SUMMARY_LOOKBACK = 200
// Keeps the summary well inside the reply budget.
const MAX_SUMMARY_CHARS = 4_000

const SUMMARY_SYSTEM = `You maintain the running summary of a conversation between a user and AskPanel's assistant, so the assistant can keep helping after older messages drop out of its context.

Rewrite the existing summary to also cover the new messages. Keep: the user's goals, constraints, numbers, names, decisions made, open questions, and every panel verdict's conclusion with its confidence. Drop pleasantries and repetition. Write compact plain prose or short bullets, at most 300 words. Output only the summary.`

// Folds messages that have left the reply window into the conversation's rolling summary
// (spec §5). Called after a reply is saved. Best effort: never throws.
export async function updateSummary(cid: string): Promise<void> {
  try {
    const ref = conversationRef(cid)
    const conversation = (await ref.get()).data() as ConversationDoc | undefined
    if (!conversation) return
    const through = conversation.summarizedThroughSeq ?? 0
    const previous = conversation.summary ?? null

    const history = await loadMessages(cid, SUMMARY_LOOKBACK)
    const budget = REPLY_BUDGET_CHARS - (previous?.length ?? 0)
    const backlog = summaryBacklog(history, through, budget)
    if (!backlog.length) return

    const transcript = backlog.map(transcriptLine).filter(Boolean).join('\n')
    const res = await getAnthropicClient().messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 700,
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
