'use client'

import { useState } from 'react'
import { PanelInput } from '@/components/panel/PanelInput'
import { PersonaSelector } from '@/components/panel/PersonaSelector'
import { ContextInput } from '@/components/panel/ContextInput'
import { StarterQuestions } from './StarterQuestions'
import { RoundsSelector } from './RoundsSelector'
import type { CustomPersona } from '@/types'

interface Props {
  tier: 'free' | 'pro'
  initialCustomPersona?: CustomPersona | null
}

export function QuestionComposer({ tier, initialCustomPersona = null }: Props) {
  const [question, setQuestion] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [persona, setPersona] = useState('general')
  const [userContext, setUserContext] = useState('')
  const [maxRounds, setMaxRounds] = useState(2)
  const [customPersona, setCustomPersona] = useState<CustomPersona | null>(initialCustomPersona)

  return (
    <div>
      <PersonaSelector
        persona={persona}
        onPersonaChange={setPersona}
        tier={tier}
        customPersona={customPersona}
        onCustomPersonaChange={setCustomPersona}
      />
      {question.trim().length === 0 && (
        <StarterQuestions onSelect={setQuestion} />
      )}
      <ContextInput tier={tier} value={userContext} onChange={setUserContext} />
      <PanelInput
        question={question}
        onQuestionChange={setQuestion}
        isPublic={isPublic}
        onIsPublicChange={setIsPublic}
        persona={persona}
        userContext={userContext}
        maxRounds={maxRounds}
      />
      <div className="mt-3 px-1">
        <RoundsSelector value={maxRounds} onChange={setMaxRounds} tier={tier} />
      </div>
    </div>
  )
}
