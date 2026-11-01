import type { DocumentReference } from 'firebase-admin/firestore'
import { streamReply } from './reply'
import { toMessageView, type NewMessage } from './store'
import type { MessageRouting, MessageView, ReplyStreamEvent } from '@/types'

interface RespondOptions {
  cid: string
  assistantRef: DocumentReference
  // The assistant message as written (status 'streaming').
  assistantMessage: NewMessage
  // Sent with 'start' so the client can add it (null when answering an existing message).
  userMessage: MessageView | null
  modelMessages: { role: 'user' | 'assistant'; content: string }[]
  // Let the model convene the panel (the coordinator). Called with its decision; converts
  // the assistant message into a debate or a proposal and returns its new view.
  route?: (routing: MessageRouting) => Promise<MessageView>
  // After the reply is saved (or routed): titles, summaries, logging. Errors are logged.
  after?: (result: { text: string; status: 'complete' | 'error'; routed: boolean }) => Promise<void>
}

// Streams an assistant reply over SSE from the POST that asked for it. Generation is not
// tied to the connection: if the client leaves, the reply still completes and is saved.
export function respond(opts: RespondOptions): Response {
  const { cid, assistantRef, assistantMessage, userMessage, modelMessages, route, after } = opts
  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: ReplyStreamEvent) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          closed = true
        }
      }
      send({ type: 'start', userMessage, assistantMessage: toMessageView(assistantRef.id, assistantMessage) })

      void (async () => {
        let text = ''
        let status: 'complete' | 'error' = 'error'
        let routed = false
        try {
          for await (const chunk of streamReply(modelMessages, { allowPanel: !!route })) {
            if (chunk.type === 'text') {
              text += chunk.text
              send({ type: 'token', text: chunk.text })
            } else if (route) {
              send({ type: 'routed', message: await route(chunk.routing) })
              routed = true
              status = 'complete'
            }
          }
          if (!routed) {
            if (!text.trim()) throw new Error('empty reply')
            await assistantRef.update({ content: text, status: 'complete' })
            status = 'complete'
            send({ type: 'done' })
          }
        } catch (err) {
          console.error('[conversations] reply failed', cid, err)
          if (!routed) await assistantRef.update({ content: text, status: 'error' }).catch(() => {})
          send({ type: 'error', message: 'The reply failed. Try again.' })
        } finally {
          if (!closed) {
            closed = true
            controller.close()
          }
          await after?.({ text, status, routed }).catch((err) => console.error('[conversations] after-reply failed', cid, err))
        }
      })()
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
