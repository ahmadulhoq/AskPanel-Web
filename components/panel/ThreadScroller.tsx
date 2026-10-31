'use client'

import { ArrowDown } from 'lucide-react'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'

interface Props {
  children: React.ReactNode
  className?: string
}

// Scroll container for streaming threads: follows new content while the reader is at the
// bottom, and stops following as soon as they scroll up to read.
export function ThreadScroller({ children, className }: Props) {
  return (
    <StickToBottom className="relative min-h-0 flex-1" resize="smooth" initial="instant">
      <StickToBottom.Content className={className}>{children}</StickToBottom.Content>
      <ScrollToLatest />
    </StickToBottom>
  )
}

function ScrollToLatest() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()
  if (isAtBottom) return null
  return (
    <button
      type="button"
      onClick={() => scrollToBottom()}
      aria-label="Scroll to latest"
      className="absolute bottom-4 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border bg-background shadow-md transition-colors hover:bg-muted"
    >
      <ArrowDown className="h-4 w-4" />
    </button>
  )
}
