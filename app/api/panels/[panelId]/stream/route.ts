import { type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { runPanel } from '@/lib/agents/orchestrator'
import { generatePanelTitle } from '@/lib/agents/title'
import { FieldValue } from 'firebase-admin/firestore'
import type { SSEEvent, PanelRound } from '@/types'

function encodeSSE(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

// Emit synthetic SSE events for rounds already stored in Firestore so
// that reconnecting clients (or the completed-panel fast-path) see the
// full thread without re-running the orchestrator.
function* replayRounds(rounds: PanelRound[]): Generator<SSEEvent> {
  for (const round of rounds) {
    if (round.respondent) {
      yield { type: 'agent_start', agent: 'respondent', round: round.roundNumber }
      yield { type: 'agent_complete', agent: 'respondent', round: round.roundNumber, content: round.respondent.content }
    }
    if (round.critic) {
      yield { type: 'agent_start', agent: 'critic', round: round.roundNumber }
      yield { type: 'agent_complete', agent: 'critic', round: round.roundNumber, content: round.critic.content }
    }
    if (round.synthesizer) {
      yield { type: 'synthesis_start', round: round.roundNumber }
      yield {
        type: 'synthesis_result',
        round: round.roundNumber,
        decision: round.synthesizer.decision,
        confidence: round.synthesizer.confidence,
        reasoning: round.synthesizer.reasoning,
        issuesFound: round.synthesizer.issuesFound ?? 0,
      }
    }
  }
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

  const encoder = new TextEncoder()
  const SSE_HEADERS = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }

  // Panel already complete: replay all stored rounds then emit panel_complete.
  if (panelData.status === 'complete') {
    const stream = new ReadableStream({
      start(controller) {
        for (const event of replayRounds(panelData.rounds ?? [])) {
          controller.enqueue(encoder.encode(encodeSSE(event)))
        }
        controller.enqueue(
          encoder.encode(
            encodeSSE({ type: 'panel_complete', finalAnswer: panelData.finalAnswer, confidence: panelData.confidence }),
          ),
        )
        controller.close()
      },
    })
    return new Response(stream, { headers: SSE_HEADERS })
  }

  // Panel queued or running: replay any rounds already written, then continue
  // with the live orchestrator. This covers mid-run reconnection — the client
  // sees the work that already happened before picking up the live stream.
  const panelGenerator = runPanel({
    panelId,
    question: panelData.question,
    config: panelData.config,
    persona: panelData.persona ?? 'general',
    context: panelData.context ?? undefined,
  })

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Emit stored rounds so reconnecting clients don't see a blank thread.
        for (const event of replayRounds(panelData.rounds ?? [])) {
          controller.enqueue(encoder.encode(encodeSSE(event)))
        }

        for await (const event of panelGenerator) {
          controller.enqueue(encoder.encode(encodeSSE(event)))

          if (event.type === 'panel_complete') {
            // Increment monthly run counter for free users.
            const userRef = db.collection('users').doc(user.uid)
            const userSnap = await userRef.get()
            const tier = userSnap.data()?.subscription?.tier ?? 'free'
            if (tier !== 'pro') {
              await userRef.update({ freeRunsUsed: FieldValue.increment(1) })
            }

            // Generate a short title asynchronously — fire and forget.
            generatePanelTitle(panelId, panelData.question)
          }
        }
      } finally {
        controller.close()
      }
    },
    cancel() {
      // Client disconnected — orchestrator continues writing to Firestore.
    },
  })

  return new Response(readable, { headers: SSE_HEADERS })
}
