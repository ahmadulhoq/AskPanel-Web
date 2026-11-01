'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuestionBubble } from '@/components/panel/QuestionBubble'
import { ThreadScroller } from '@/components/panel/ThreadScroller'
import { PaywallDialog } from '@/components/panel/PaywallDialog'
import { drainSSE } from '@/lib/sse/parse'
import { AssistantReply } from './AssistantReply'
import { ChatComposer, type SendMode } from './ChatComposer'
import { DebateBlock } from './DebateBlock'
import type { MessageView, ReplyStreamEvent } from '@/types'

interface Props {
  conversationId: string
  initialMessages: MessageView[]
  // First message handed over from the new-conversation composer.
  pending: { content: string; mode: SendMode } | null
}

export function ConversationView({ conversationId, initialMessages, pending }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [showPaywall, setShowPaywall] = useState(false)

  const patch = (id: string, change: (m: MessageView) => MessageView) =>
    setMessages((all) => all.map((m) => (m.id === id ? change(m) : m)))

  // Returns false (keeping the user's text in the input) when nothing was sent.
  const handleFailure = useCallback(async (res: Response) => {
    if (res.status === 402) {
      setShowPaywall(true)
      return false
    }
    const data = await res.json().catch(() => ({}))
    setError(data.error ?? 'Something went wrong. Please try again.')
    return false
  }, [])

  const send = useCallback(async (content: string, mode: SendMode): Promise<boolean> => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, mode }),
      })
      if (!res.ok) return await handleFailure(res)

      if (mode === 'debate') {
        const { messages: added } = (await res.json()) as { messages: MessageView[] }
        setMessages((all) => [...all, ...added])
        return true
      }

      // Quick reply: append the message pair, then stream the reply into it.
      let replyId: string | null = null
      let finished = false
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        const { data, rest } = drainSSE(buffer + decoder.decode(value, { stream: true }))
        buffer = rest
        for (const raw of data) {
          const event = JSON.parse(raw) as ReplyStreamEvent
          if (event.type === 'start') {
            replyId = event.assistantMessage.id
            setMessages((all) => [...all, event.userMessage, event.assistantMessage])
          } else if (replyId && event.type === 'token') {
            patch(replyId, (m) => ({ ...m, content: m.content + event.text }))
          } else if (replyId && event.type === 'done') {
            finished = true
            patch(replyId, (m) => ({ ...m, status: 'complete' }))
          } else if (replyId && event.type === 'error') {
            finished = true
            patch(replyId, (m) => ({ ...m, status: 'error' }))
          }
        }
      }
      // The connection dropped mid-reply. The server keeps generating and saves it.
      if (replyId && !finished) {
        patch(replyId, (m) => ({ ...m, status: 'error' }))
        setError('Connection lost — refresh to load the saved reply.')
      }
      return replyId !== null
    } catch {
      setError('Network error. Please try again.')
      return false
    } finally {
      setBusy(false)
    }
  }, [conversationId, handleFailure])

  const debateReply = useCallback(async (messageId: string) => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch(`/api/conversations/${conversationId}/debates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      if (!res.ok) {
        await handleFailure(res)
        return
      }
      const { message } = (await res.json()) as { message: MessageView }
      setMessages((all) => [...all, message])
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }, [conversationId, handleFailure])

  // Send the first message once, after dropping it from the URL so a refresh can't resend it.
  const sentPending = useRef(false)
  useEffect(() => {
    if (!pending || sentPending.current) return
    sentPending.current = true
    router.replace(`/chat/${conversationId}`, { scroll: false })
    send(pending.content, pending.mode)
  }, [pending, conversationId, router, send])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ThreadScroller className="mx-auto w-full max-w-2xl space-y-8 px-4 py-8" followKey={messages.length}>
        {messages.length === 0 && !pending && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Ask anything. Quick questions get a quick answer — hit <span className="font-medium">Debate</span> when
            something deserves a panel.
          </p>
        )}
        {messages.map((m) =>
          m.role === 'user' ? (
            <QuestionBubble key={m.id} question={m.content} />
          ) : m.kind === 'debate' && m.panelId ? (
            <DebateBlock key={m.id} panelId={m.panelId} initial={m.debate} />
          ) : (
            <AssistantReply key={m.id} message={m} onDebate={debateReply} debateDisabled={busy} />
          ),
        )}
      </ThreadScroller>

      <div className="mx-auto w-full max-w-2xl px-4 pb-4">
        {error && <p className="mb-2 px-2 text-sm text-destructive" role="alert">{error}</p>}
        <ChatComposer onSubmit={send} disabled={busy} autoFocus />
      </div>

      <PaywallDialog open={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  )
}
