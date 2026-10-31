import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'
import { getOwnedConversation, loadMessages } from '@/lib/conversations/store'
import { ConversationView } from '@/components/chat/ConversationView'
import { Button } from '@/components/ui/button'

interface Props {
  params: Promise<{ cid: string }>
  searchParams: Promise<{ q?: string; mode?: string }>
}

export const metadata = { title: 'Chat — AskPanel' }

export default async function ConversationPage({ params, searchParams }: Props) {
  const { cid } = await params
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const conversation = await getOwnedConversation(cid, user.uid)
  if (!conversation) notFound()

  const messages = await loadMessages(cid)
  const { q, mode } = await searchParams
  // Only a brand-new conversation accepts a first message from the URL.
  const pending = q && messages.length === 0
    ? { content: q.slice(0, 4000), mode: mode === 'debate' ? ('debate' as const) : ('reply' as const) }
    : null

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/chat">
            <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
              ← Chats
            </Button>
          </Link>
          <span className="truncate text-sm font-medium">{conversation.title ?? 'New conversation'}</span>
        </div>
      </header>
      <ConversationView conversationId={cid} initialMessages={messages} pending={pending} />
    </div>
  )
}
