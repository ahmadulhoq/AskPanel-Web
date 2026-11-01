interface Props {
  question: string
  // Context the user attached to this message (chat).
  context?: string | null
}

// The user's question, rendered as a right-aligned chat bubble — the same
// convention used by ChatGPT, Claude and Gemini. Shared between the live
// panel view and the public share view so both stay visually consistent.
export function QuestionBubble({ question, context }: Props) {
  return (
    <div className="mb-8 flex flex-col items-end gap-1">
      <div className="max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-3 text-primary-foreground">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{question}</p>
      </div>
      {context && (
        <details className="max-w-[85%] text-right text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none hover:text-foreground">Context attached</summary>
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-2 text-left">{context}</p>
        </details>
      )}
    </div>
  )
}
