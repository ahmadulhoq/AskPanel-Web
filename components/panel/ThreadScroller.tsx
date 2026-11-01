'use client'

import { useEffect, useRef } from 'react'
import { ArrowDown } from 'lucide-react'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'

interface Props {
  children: React.ReactNode
  className?: string
  // Changes when the user adds something (sends a message, starts a debate): jump to it
  // even if they had scrolled up. Streaming text only follows while they're at the bottom.
  followKey?: string | number
}

// Scroll container for streaming threads: follows new content while the reader is at the
// bottom, and stops following as soon as they scroll up to read.
export function ThreadScroller({ children, className, followKey }: Props) {
  return (
    <StickToBottom className="relative min-h-0 flex-1" resize="smooth" initial="instant">
      <StickToBottom.Content className={className}>{children}</StickToBottom.Content>
      <ScrollToLatest />
      {followKey !== undefined && <JumpOnChange value={followKey} />}
    </StickToBottom>
  )
}

function JumpOnChange({ value }: { value: string | number }) {
  const { scrollToBottom } = useStickToBottomContext()
  const previous = useRef(value)
  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    scrollToBottom()
  }, [value, scrollToBottom])
  return null
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
