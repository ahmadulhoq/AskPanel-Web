import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'
import { getOwnedConversation, loadMessages } from '@/lib/conversations/store'
import { DEFAULT_DEBATE_SETTINGS, sanitizeDebateSettings } from '@/lib/conversations/settings'
import { ConversationView } from '@/components/chat/ConversationView'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteButton } from '@/components/ConfirmDeleteButton'

interface Props {
  params: Promise<{ cid: string }>
  searchParams: Promise<{ q?: string; mode?: string; persona?: string; rounds?: string; panel?: string }>
}

export const metadata = { title: 'Chat — AskPanel' }

export default async function ConversationPage({ params, searchParams }: Props) {
  const { cid } = await params
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const conversation = await getOwnedConversation(cid, user.uid)
  if (!conversation) notFound()

  const [messages, userSnap] = await Promise.all([
    loadMessages(cid),
    adminDb().collection('users').doc(user.uid).get(),
  ])
  const userData = userSnap.data()
  const tier = (userData?.subscription?.tier ?? 'free') as 'free' | 'pro'

  const { q, mode, persona, rounds, panel } = await searchParams
  // Only a brand-new conversation accepts a first message (and its settings) from the URL.
  const fresh = !!q && messages.length === 0
  const pending = fresh
    ? { content: q.slice(0, 4000), mode: mode === 'debate' ? ('debate' as const) : ('reply' as const) }
    : null
  const settings = fresh && persona
    ? sanitizeDebateSettings({ persona, maxRounds: Number(rounds), mode: panel })
    : conversation.debateSettings ? sanitizeDebateSettings(conversation.debateSettings) : DEFAULT_DEBATE_SETTINGS

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
              ← All conversations
            </Button>
          </Link>
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sm font-medium">{conversation.title ?? 'New conversation'}</span>
            <ConfirmDeleteButton
              what="conversation"
              endpoint={`/api/conversations/${cid}`}
              redirectTo="/dashboard"
              description="All its messages and the debates started in it are deleted. This can’t be undone."
            />
          </div>
        </div>
      </header>
      <ConversationView
        conversationId={cid}
        initialMessages={messages}
        pending={pending}
        tier={tier}
        initialCustomPersona={userData?.customPersona ?? null}
        initialSettings={settings}
      />
    </div>
  )
}
