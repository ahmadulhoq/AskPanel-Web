import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { PanelThread } from '@/components/panel/PanelThread'
import { QuestionBubble } from '@/components/panel/QuestionBubble'
import { ShareButton } from '@/components/panel/ShareButton'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'
import { ThreadScroller } from '@/components/panel/ThreadScroller'
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
    <div className="flex h-dvh flex-col">
      <header className="z-10 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
              ← Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-1">
            {panel.isPublic && <ShareButton url={shareUrl} />}
            <ConfirmDeleteButton
              what="panel"
              endpoint={`/api/panels/${panelId}`}
              redirectTo={panel.conversationId ? `/chat/${panel.conversationId}` : '/dashboard'}
              description={panel.conversationId
                ? 'The debate and its verdict are removed from your conversation too. This can’t be undone.'
                : 'The question, debate and verdict are deleted, and any share link stops working. This can’t be undone.'}
            />
          </div>
        </div>
      </header>

      <ThreadScroller className="mx-auto w-full max-w-2xl px-4 py-8">
        <QuestionBubble question={panel.question} />
        <PanelThread panelId={panelId} persona={panel.persona ?? 'general'} isPublic={panel.isPublic} />
      </ThreadScroller>
    </div>
  )
}
