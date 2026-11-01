'use client'

import { useState } from 'react'
import { PanelInput } from '@/components/panel/PanelInput'
import { PersonaSelector } from '@/components/panel/PersonaSelector'
import { ContextInput } from '@/components/panel/ContextInput'
import { StarterQuestions } from './StarterQuestions'
import { RoundsSelector } from './RoundsSelector'
import { ModeSelector } from '@/components/panel/ModeSelector'
import type { CustomPersona, PanelMode } from '@/types'

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
  const [mode, setMode] = useState<PanelMode>('critique')
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
        mode={mode}
      />
      <div className="mt-3 px-1">
        <ModeSelector value={mode} onChange={setMode} />
        {mode === 'critique' && <RoundsSelector value={maxRounds} onChange={setMaxRounds} tier={tier} />}
      </div>
    </div>
  )
}
