import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { PanelThread } from '@/components/panel/PanelThread'
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
  return { title: panel ? `${panel.question.slice(0, 60)}… — AskPanel` : 'Panel — AskPanel' }
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

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/p/${panelId}`

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">← Dashboard</Button>
        </Link>
        <Button
          variant="outline"
          size="sm"
          onClick={undefined}
          data-share-url={shareUrl}
          id="share-btn"
        >
          Share
        </Button>
      </div>

      <div className="mb-6">
        <h1 className="text-lg font-semibold">{panel.question}</h1>
      </div>

      <PanelThread panelId={panelId} />
    </main>
  )
}
