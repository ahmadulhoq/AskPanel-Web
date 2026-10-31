'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChatComposer, type SendMode } from './ChatComposer'

export function NewConversation() {
  const router = useRouter()
  const [error, setError] = useState('')

  async function start(content: string, mode: SendMode): Promise<boolean> {
    setError('')
    try {
      const res = await fetch('/api/conversations', { method: 'POST' })
      if (!res.ok) {
        setError('Could not start a conversation. Please try again.')
        return false
      }
      const { conversationId } = await res.json()
      // The conversation page sends this first message and removes it from the URL.
      const params = new URLSearchParams({ q: content, mode })
      router.push(`/chat/${conversationId}?${params}`)
      return true
    } catch {
      setError('Network error. Please try again.')
      return false
    }
  }

  return (
    <div>
      {error && <p className="mb-2 px-2 text-sm text-destructive" role="alert">{error}</p>}
      <ChatComposer onSubmit={start} autoFocus placeholder="Start a conversation — plans, decisions, anything." />
    </div>
  )
}
