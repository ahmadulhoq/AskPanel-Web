import { generateTitle } from '@/lib/agents/title'
import { conversationRef } from './store'

// Names a conversation after its first message. Best effort, never throws.
export async function titleConversation(cid: string, firstMessage: string): Promise<void> {
  const title = await generateTitle(firstMessage)
  if (!title) return
  await conversationRef(cid).update({ title }).catch((err) => {
    console.error('[conversations] could not save title', cid, err)
  })
}
