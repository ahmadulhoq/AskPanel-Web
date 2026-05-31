interface Props {
  question: string
}

// The user's question, rendered as a right-aligned chat bubble — the same
// convention used by ChatGPT, Claude and Gemini. Shared between the live
// panel view and the public share view so both stay visually consistent.
export function QuestionBubble({ question }: Props) {
  return (
    <div className="mb-8 flex justify-end">
      <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-primary-foreground">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{question}</p>
      </div>
    </div>
  )
}
