const STARTERS = [
  { label: 'Career',    question: "I have a job offer that pays 30% more but requires relocating away from family. Should I take it?" },
  { label: 'Strategy',  question: "We're a 5-person startup with $200k runway. Should we raise a seed round now or try to reach profitability first?" },
  { label: 'Invest',    question: "Is putting 20% of my savings into index funds each month a sound strategy for a 30-year horizon?" },
  { label: 'Ethics',    question: "Is it ethical to use AI-generated content commercially without disclosing it to the audience?" },
  { label: 'Technical', question: "Should we migrate our monolith to microservices now, or wait until we have clear scaling pain?" },
  { label: 'Decision',  question: "I've been offered equity in an early-stage startup as partial compensation. How should I evaluate whether it's worth taking?" },
]

interface Props {
  onSelect: (question: string) => void
}

export function StarterQuestions({ onSelect }: Props) {
  return (
    <div className="mb-4">
      <p className="mb-2.5 text-xs font-medium text-muted-foreground">Try an example</p>
      <div className="flex flex-wrap gap-2">
        {STARTERS.map(({ label, question }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(question)}
            className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
