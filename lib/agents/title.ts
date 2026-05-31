import { getAnthropicClient, DEFAULT_MODEL } from '@/lib/anthropic'
import { adminDb } from '@/lib/firebase/admin'

// Fire-and-forget after panel_complete. Failures are caught and logged —
// the panel is already complete so no user-facing error is needed.
export async function generatePanelTitle(panelId: string, question: string): Promise<void> {
  try {
    const response = await getAnthropicClient().messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 30,
      messages: [{
        role: 'user',
        content: `Summarise this question in 5–8 words. No punctuation, no trailing period, title case.\n\nQuestion: ${question}`,
      }],
    })

    const block = response.content[0]
    if (block.type !== 'text') return
    const title = block.text.trim().replace(/[.!?]+$/, '')
    if (!title) return

    await adminDb().collection('panels').doc(panelId).update({ title })
  } catch (err) {
    console.error('[title] generation failed for panel', panelId, err)
  }
}
