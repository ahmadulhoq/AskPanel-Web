import { getAnthropicClient, LIGHT_MODEL } from '@/lib/anthropic'
import { adminDb } from '@/lib/firebase/admin'

// A 5–8 word title for a question, or null if generation fails.
export async function generateTitle(question: string): Promise<string | null> {
  try {
    const response = await getAnthropicClient().messages.create({
      model: LIGHT_MODEL,
      max_tokens: 64,
      thinking: { type: 'disabled' },
      messages: [{
        role: 'user',
        content: `Summarise this question in 5–8 words. No punctuation, no trailing period, title case.\n\nQuestion: ${question}`,
      }],
    })
    // Read the text block by type: with thinking on, a response can start with a thinking block.
    const block = response.content.find((b) => b.type === 'text')
    if (block?.type !== 'text') return null
    return block.text.trim().replace(/[.!?]+$/, '') || null
  } catch (err) {
    console.error('[title] generation failed', err)
    return null
  }
}

// Runs after the panel is complete, so failures are logged, never surfaced.
export async function generatePanelTitle(panelId: string, question: string): Promise<void> {
  const title = await generateTitle(question)
  if (!title) return
  await adminDb().collection('panels').doc(panelId).update({ title }).catch((err) => {
    console.error('[title] could not save title for panel', panelId, err)
  })
}
