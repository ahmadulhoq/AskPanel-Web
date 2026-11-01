import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { NewConversation } from '@/components/chat/NewConversation'
import { Button } from '@/components/ui/button'
import type { ConversationDoc } from '@/types'

export const metadata = { title: 'Chat — AskPanel' }

function formatDate(ms: number | undefined) {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default async function ChatListPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [userSnap, snap] = await Promise.all([
    adminDb().collection('users').doc(user.uid).get(),
    adminDb()
      .collection('conversations')
      .where('userId', '==', user.uid)
      .orderBy('updatedAt', 'desc')
      .limit(50)
      .get(),
  ])
  const userData = userSnap.data()
  const tier = (userData?.subscription?.tier ?? 'free') as 'free' | 'pro'
  const customPersona = userData?.customPersona ?? null
  const conversations = snap.docs.map((d) => {
    const data = d.data() as ConversationDoc
    return { id: d.id, title: data.title, updatedAt: data.updatedAt?.toMillis() }
  })

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Chat <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-primary">BETA</span>
        </h1>
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            ← Dashboard
          </Button>
        </Link>
      </div>

      <section className="mb-10">
        <NewConversation tier={tier} initialCustomPersona={customPersona} />
      </section>

      {conversations.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Conversations</h2>
          <ul className="space-y-2">
            {conversations.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/chat/${c.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                >
                  <span className="line-clamp-1 text-sm">{c.title ?? 'New conversation'}</span>
                  <span className="ml-4 shrink-0 text-xs text-muted-foreground">{formatDate(c.updatedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
