import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/firebase/admin'
import { FinalAnswer } from '@/components/panel/FinalAnswer'
import { AgentTurn } from '@/components/panel/AgentTurn'
import { SynthesisCard } from '@/components/panel/SynthesisCard'
import type { PanelDoc, AgentTurnState, SynthesisState, ConfidenceLevel, SynthesisDecision } from '@/types'

interface Props {
  params: Promise<{ panelId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { panelId } = await params
  const db = adminDb()
  const snap = await db.collection('panels').doc(panelId).get()
  const panel = snap.data() as PanelDoc | undefined
  if (!panel?.isPublic) return {}
  return {
    title: `${panel.question.slice(0, 60)}… — AskPanel`,
    description: panel.finalAnswer?.slice(0, 150),
    openGraph: {
      title: panel.question.slice(0, 60),
      description: panel.finalAnswer?.slice(0, 150) ?? 'Multi-agent AI deliberation',
      type: 'article',
    },
  }
}

export default async function PublicPanelPage({ params }: Props) {
  const { panelId } = await params
  const db = adminDb()
  const snap = await db.collection('panels').doc(panelId).get()

  if (!snap.exists) notFound()

  const panel = snap.data() as PanelDoc
  if (!panel.isPublic || panel.status !== 'complete') notFound()

  // Reconstruct turns and syntheses from stored rounds
  const turns: AgentTurnState[] = []
  const syntheses: SynthesisState[] = []

  for (const round of panel.rounds) {
    if (round.respondent) {
      turns.push({ agent: 'respondent', round: round.roundNumber, content: round.respondent.content, streaming: false })
    }
    if (round.critic) {
      turns.push({ agent: 'critic', round: round.roundNumber, content: round.critic.content, streaming: false })
    }
    if (round.synthesizer) {
      syntheses.push({
        round: round.roundNumber,
        decision: round.synthesizer.decision as SynthesisDecision,
        confidence: round.synthesizer.confidence as ConfidenceLevel,
        reasoning: round.synthesizer.reasoning,
      })
    }
  }

  const roundNumbers = [...new Set(turns.map(t => t.round))].sort((a, b) => a - b)

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        AskPanel · Shared deliberation
      </div>
      <h1 className="mb-8 text-lg font-semibold">{panel.question}</h1>

      <div className="space-y-4">
        {roundNumbers.map(round => (
          <div key={round} className="space-y-3">
            {turns
              .filter(t => t.round === round)
              .map((turn, i) => (
                <AgentTurn key={i} turn={turn} />
              ))}
            {syntheses
              .filter(s => s.round === round)
              .map(s => (
                <SynthesisCard key={s.round} synthesis={s} />
              ))}
          </div>
        ))}

        {panel.finalAnswer && panel.confidence && (
          <FinalAnswer answer={panel.finalAnswer} confidence={panel.confidence as ConfidenceLevel} />
        )}
      </div>

      <div className="mt-10 border-t pt-6 text-center text-sm text-muted-foreground">
        <a href="/" className="underline">Try AskPanel</a> — AI deliberation for questions that matter
      </div>
    </main>
  )
}
