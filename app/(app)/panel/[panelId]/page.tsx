import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { PanelThread } from '@/components/panel/PanelThread'
import { QuestionBubble } from '@/components/panel/QuestionBubble'
import { ShareButton } from '@/components/panel/ShareButton'
import { Button } from '@/components/ui/button'
import type { PanelDoc } from '@/types'

interface Props {
  params: Promise<{ panelId: string }>
}

export async function generateMetadata({ params }: Props) {
  const { panelId } = await params
  const db = adminDb()
  const snap = await db.collection('panels').doc(panelId).get()
  const panel = snap.data() as PanelDoc | undefined
  const title = panel?.title ?? panel?.question.slice(0, 60)
  return { title: title ? `${title} — AskPanel` : 'Panel — AskPanel' }
}

export default async function PanelPage({ params }: Props) {
  const { panelId } = await params
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const db = adminDb()
  const snap = await db.collection('panels').doc(panelId).get()
  if (!snap.exists) notFound()

  const panel = snap.data() as PanelDoc
  if (panel.userId !== user.uid) redirect('/dashboard')

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/p/${panelId}`

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
              ← Dashboard
            </Button>
          </Link>
          {panel.isPublic && <ShareButton url={shareUrl} />}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <QuestionBubble question={panel.question} />
        <PanelThread panelId={panelId} persona={panel.persona ?? 'general'} isPublic={panel.isPublic} />
      </main>
    </div>
  )
}
