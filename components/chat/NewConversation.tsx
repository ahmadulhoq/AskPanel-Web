'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChatComposer, type SendMode } from './ChatComposer'
import { DebateSettingsPanel, debateSettingsLabel } from './DebateSettingsPanel'
import { DEFAULT_DEBATE_SETTINGS } from '@/lib/conversations/settings'
import type { CustomPersona } from '@/types'

interface Props {
  tier: 'free' | 'pro'
  initialCustomPersona: CustomPersona | null
}

export function NewConversation({ tier, initialCustomPersona }: Props) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [settings, setSettings] = useState(DEFAULT_DEBATE_SETTINGS)
  const [customPersona, setCustomPersona] = useState(initialCustomPersona)

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
      const params = new URLSearchParams({
        q: content, mode, persona: settings.persona, rounds: String(settings.maxRounds),
      })
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
      <ChatComposer
        onSubmit={start}
        autoFocus
        placeholder="Start a conversation — plans, decisions, anything."
        settings={{
          label: debateSettingsLabel(settings, customPersona),
          panel: (
            <DebateSettingsPanel
              tier={tier}
              value={settings}
              onChange={setSettings}
              customPersona={customPersona}
              onCustomPersonaChange={setCustomPersona}
            />
          ),
        }}
      />
    </div>
  )
}
