import { type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { runPanelJob } from '@/lib/agents/runner'
import { newCursor, diffPanel, type PanelView } from '@/lib/panels/streamDiff'
import type { SSEEvent } from '@/types'

const KEEPALIVE_MS = 15_000

function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ panelId: string }> },
) {
  const { panelId } = await params
  const user = await getSessionUser()
  if (!user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const ref = adminDb().collection('panels').doc(panelId)
  const panelSnap = await ref.get()
  if (!panelSnap.exists) {
    return new Response('Not Found', { status: 404 })
  }

  const panelData = panelSnap.data()!
  if (panelData.userId !== user.uid) {
    return new Response('Forbidden', { status: 403 })
  }

  // The run is not tied to this connection: closing the page doesn't stop it, and a
  // reconnect or second tab only watches. runPanelJob is a no-op while a runner holds the lease.
  if (panelData.status === 'queued' || panelData.status === 'running') {
    runPanelJob(panelId).catch((err) => console.error('[stream] runner crashed', panelId, err))
  }

  // Every connection replays from the stored state, so reconnects are always consistent.
  const encoder = new TextEncoder()
  const cursor = newCursor()
  let closed = false
  let cleanup = () => {}

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk))
      }
      const close = () => {
        if (closed) return
        closed = true
        cleanup()
        controller.close()
      }

      const keepalive = setInterval(() => send(': keepalive\n\n'), KEEPALIVE_MS)
      const unsubscribe = ref.onSnapshot(
        (doc) => {
          if (!doc.exists) {
            send(encodeSSE({ type: 'error', message: 'This panel no longer exists.' }))
            close()
            return
          }
          for (const event of diffPanel(cursor, doc.data() as PanelView)) send(encodeSSE(event))
          if (cursor.done) close()
        },
        (err) => {
          // The client reconnects and replays, so dropping the stream is safe.
          console.error('[stream] snapshot listener failed', panelId, err)
          close()
        },
      )
      cleanup = () => {
        unsubscribe()
        clearInterval(keepalive)
      }
      request.signal.addEventListener('abort', close)
    },
    cancel() {
      closed = true
      cleanup()
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
