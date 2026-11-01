'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChatComposer, type SendMode } from './ChatComposer'
import { DebateSettingsPanel, debateSettingsLabel } from './DebateSettingsPanel'
import { stashPendingContext } from './pendingContext'
import { StarterQuestions } from '@/components/dashboard/StarterQuestions'
import { DEFAULT_DEBATE_SETTINGS } from '@/lib/conversations/settings'
import { EMPTY_OPTIONS, filledOptions } from '@/components/panel/CompareOptionsInput'
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
  const [context, setContext] = useState('')
  const [options, setOptions] = useState(EMPTY_OPTIONS)
  const [starter, setStarter] = useState<{ text: string; n: number }>({ text: '', n: 0 })

  async function start(content: string, mode: SendMode): Promise<boolean> {
    setError('')
    try {
      const res = await fetch('/api/conversations', { method: 'POST' })
      if (!res.ok) {
        setError('Could not start a conversation. Please try again.')
        return false
      }
      const { conversationId } = await res.json()
      // Too long for the URL: handed to the conversation page through session storage.
      const named = settings.mode === 'compare' ? filledOptions(options) : undefined
      if (context.trim() || named) stashPendingContext(conversationId, { context, options: named })
      // The conversation page sends this first message and removes it from the URL.
      const params = new URLSearchParams({
        q: content, mode, persona: settings.persona, rounds: String(settings.maxRounds), panel: settings.mode,
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
        key={starter.n}
        initialText={starter.text}
        onSubmit={start}
        autoFocus
        placeholder="Start a conversation — plans, decisions, anything."
        settings={{
          label: debateSettingsLabel(settings, customPersona, context, options),
          panel: (
            <DebateSettingsPanel
              tier={tier}
              value={settings}
              onChange={setSettings}
              customPersona={customPersona}
              onCustomPersonaChange={setCustomPersona}
              context={context}
              onContextChange={setContext}
              options={options}
              onOptionsChange={setOptions}
            />
          ),
        }}
      />
      <div className="mt-4">
        <StarterQuestions onSelect={(text) => setStarter((s) => ({ text, n: s.n + 1 }))} />
      </div>
    </div>
  )
}
