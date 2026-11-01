import { notFound } from 'next/navigation'
import Link from 'next/link'
import { adminDb } from '@/lib/firebase/admin'
import { FinalAnswer } from '@/components/panel/FinalAnswer'
import { ThreadView } from '@/components/panel/ThreadView'
import { QuestionBubble } from '@/components/panel/QuestionBubble'
import { stateFromPanel } from '@/lib/panels/replay'
import type { PanelDoc } from '@/types'

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

  // Rebuilt the same way a live viewer's thread is: stored panel → events → state.
  const state = stateFromPanel(panel)

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
          <ThreadView state={state} />

          {panel.finalAnswer && panel.confidence && (
            <FinalAnswer answer={panel.finalAnswer} confidence={panel.confidence} />
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
