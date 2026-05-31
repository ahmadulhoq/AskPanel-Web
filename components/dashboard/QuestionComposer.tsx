'use client'

import { useState } from 'react'
import { PanelInput } from '@/components/panel/PanelInput'
import { PersonaSelector } from '@/components/panel/PersonaSelector'
import { StarterQuestions } from './StarterQuestions'

interface Props {
  tier: 'free' | 'pro'
}

export function QuestionComposer({ tier }: Props) {
  const [question, setQuestion] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [persona, setPersona] = useState('general')

  return (
    <div>
      <PersonaSelector persona={persona} onPersonaChange={setPersona} tier={tier} />
      {question.trim().length === 0 && (
        <StarterQuestions onSelect={setQuestion} />
      )}
      <PanelInput
        question={question}
        onQuestionChange={setQuestion}
        isPublic={isPublic}
        onIsPublicChange={setIsPublic}
        persona={persona}
      />
    </div>
  )
}
