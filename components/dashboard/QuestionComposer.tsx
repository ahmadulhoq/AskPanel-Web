'use client'

import { useState } from 'react'
import { PanelInput } from '@/components/panel/PanelInput'
import { PersonaSelector } from '@/components/panel/PersonaSelector'
import { ContextInput } from '@/components/panel/ContextInput'
import { StarterQuestions } from './StarterQuestions'
import { RoundsSelector } from './RoundsSelector'

interface Props {
  tier: 'free' | 'pro'
}

export function QuestionComposer({ tier }: Props) {
  const [question, setQuestion] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [persona, setPersona] = useState('general')
  const [userContext, setUserContext] = useState('')
  const [maxRounds, setMaxRounds] = useState(2)

  return (
    <div>
      <PersonaSelector persona={persona} onPersonaChange={setPersona} tier={tier} />
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
