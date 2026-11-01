'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Scale, Search, X } from 'lucide-react'
import type { ConversationSummary } from '@/types'

interface Props {
  initialConversations: ConversationSummary[]
  // Cursor for the page after the first (null if everything fits on it).
  initialNext: string | null
}

function formatWhen(ms: number) {
  if (!ms) return ''
  const d = new Date(ms)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) })
}

// The user's conversations, most recently active first, with paging and a title search.
export function ConversationList({ initialConversations, initialNext }: Props) {
  // Later pages are kept apart, so a server refresh of the first page still shows.
  const [older, setOlder] = useState<{ conversations: ConversationSummary[]; next: string | null } | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')

  const all = useMemo(() => {
    if (!older) return initialConversations
    const seen = new Set(initialConversations.map((c) => c.id))
    return [...initialConversations, ...older.conversations.filter((c) => !seen.has(c.id))]
  }, [initialConversations, older])
  const next = older ? older.next : initialNext
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? all.filter((c) => (c.title ?? 'New conversation').toLowerCase().includes(q)) : all
  }, [all, query])

  async function loadMore() {
    if (!next) return
    setLoadingMore(true)
    setLoadError('')
    try {
      const res = await fetch(`/api/conversations?cursor=${encodeURIComponent(next)}`)
      if (!res.ok) throw new Error()
      const page = (await res.json()) as { conversations: ConversationSummary[]; next: string | null }
      setOlder((prev) => ({ conversations: [...(prev?.conversations ?? []), ...page.conversations], next: page.next }))
    } catch {
      setLoadError('Could not load more conversations.')
    } finally {
      setLoadingMore(false)
    }
  }

  if (all.length === 0) return null

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Conversations</h2>
      </div>

      {all.length > 5 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-8 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No conversations match your search.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((c) => (
            <li key={c.id}>
              <Link
                href={`/chat/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <span className="line-clamp-1 text-sm">{c.title ?? 'New conversation'}</span>
                <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                  {c.debateCount > 0 && (
                    <span className="flex items-center gap-1" title={`${c.debateCount} debate${c.debateCount === 1 ? '' : 's'}`}>
                      <Scale className="h-3 w-3" />
                      {c.debateCount}
                    </span>
                  )}
                  {formatWhen(c.updatedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {next && !query && (
        <div className="mt-4 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-full border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Show more'}
          </button>
          {loadError && <p className="text-xs text-destructive">{loadError}</p>}
        </div>
      )}
    </section>
  )
}
