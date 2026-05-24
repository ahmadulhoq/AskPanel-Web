import { type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { runPanel } from '@/lib/agents/orchestrator'
import { FieldValue } from 'firebase-admin/firestore'
import type { SSEEvent } from '@/types'

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

  const db = adminDb()
  const panelSnap = await db.collection('panels').doc(panelId).get()
  if (!panelSnap.exists) {
    return new Response('Not Found', { status: 404 })
  }

  const panelData = panelSnap.data()!
  if (panelData.userId !== user.uid) {
    return new Response('Forbidden', { status: 403 })
  }

  // If already complete, stream the stored result immediately
  if (panelData.status === 'complete') {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            encodeSSE({
              type: 'panel_complete',
              finalAnswer: panelData.finalAnswer,
              confidence: panelData.confidence,
            }),
          ),
        )
        controller.close()
      },
    })
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  }

  const encoder = new TextEncoder()
  const panelGenerator = runPanel({
    panelId,
    question: panelData.question,
    config: panelData.config,
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of panelGenerator) {
          controller.enqueue(encoder.encode(encodeSSE(event)))

          // Increment freeRunsUsed only on successful completion
          if (event.type === 'panel_complete') {
            const userRef = db.collection('users').doc(user.uid)
            const userSnap = await userRef.get()
            const tier = userSnap.data()?.subscription?.tier ?? 'free'
            if (tier !== 'pro') {
              await userRef.update({ freeRunsUsed: FieldValue.increment(1) })
            }
          }
        }
      } finally {
        controller.close()
      }
    },
    cancel() {
      // Client disconnected — orchestrator continues writing to Firestore
    },
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
