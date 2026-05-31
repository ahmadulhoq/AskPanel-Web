'use client'

import { useState } from 'react'
import { PanelInput } from '@/components/panel/PanelInput'
import { StarterQuestions } from './StarterQuestions'

export function QuestionComposer() {
  const [question, setQuestion] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  return (
    <div>
      {question.trim().length === 0 && (
        <StarterQuestions onSelect={setQuestion} />
      )}
      <PanelInput
        question={question}
        onQuestionChange={setQuestion}
        isPublic={isPublic}
        onIsPublicChange={setIsPublic}
      />
    </div>
  )
}
