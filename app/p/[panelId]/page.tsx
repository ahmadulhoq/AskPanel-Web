import { notFound } from 'next/navigation'
import Link from 'next/link'
import { adminDb } from '@/lib/firebase/admin'
import { FinalAnswer } from '@/components/panel/FinalAnswer'
import { AgentTurn } from '@/components/panel/AgentTurn'
import { SynthesisCard } from '@/components/panel/SynthesisCard'
import { QuestionBubble } from '@/components/panel/QuestionBubble'
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
        issuesFound: round.synthesizer.issuesFound ?? 0,
      })
    }
  }

  const roundNumbers = [...new Set(turns.map(t => t.round))].sort((a, b) => a - b)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-bold">AskPanel</Link>
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Shared deliberation
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <QuestionBubble question={panel.question} />

        <div className="space-y-8">
          {roundNumbers.map((round, roundIdx) => (
            <div key={round} className="space-y-6">
              {roundIdx > 0 && (
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">Round {round}</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              )}
              {turns
                .filter(t => t.round === round)
                .map((turn, i) => {
                  const sameSynthesis = turn.agent === 'critic'
                    ? syntheses.find(s => s.round === round)
                    : undefined
                  return (
                    <AgentTurn key={i} turn={turn} issuesFound={sameSynthesis?.issuesFound} />
                  )
                })}
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

        <div className="mt-12 border-t pt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="font-medium text-foreground underline underline-offset-4">
            Try AskPanel
          </Link>{' '}
          — AI deliberation for questions that matter
        </div>
      </main>
    </div>
  )
}
