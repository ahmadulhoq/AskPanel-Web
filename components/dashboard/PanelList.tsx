'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Search, Lock, CornerDownRight, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ConfidenceBadge } from '@/components/panel/ConfidenceBadge'
import type { ConfidenceLevel, PanelStatus } from '@/types'

export interface PanelSummary {
  id: string
  question: string
  title: string | null
  persona: string
  personaLabel: string | null
  status: PanelStatus
  isPublic: boolean
  parentPanelId: string | null
  confidence: ConfidenceLevel | null
}

type StatusFilter = 'all' | 'complete' | 'running' | 'error'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'complete', label: 'Complete' },
  { value: 'running', label: 'Running' },
  { value: 'error', label: 'Error' },
]

interface Props {
  panels: PanelSummary[]
}

export function PanelList({ panels }: Props) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return panels.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false
      if (q) {
        const text = (p.title ?? p.question).toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [panels, query, statusFilter])

  if (panels.length === 0) return null

  const showFilters = panels.length > 3

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Recent panels
        </h2>
        <span className="text-xs text-muted-foreground">{panels.length} total</span>
      </div>

      {showFilters && (
        <div className="mb-3 space-y-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search panels…"
              className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-8 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
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

          {/* Status pills */}
          <div className="flex gap-1.5">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStatusFilter(opt.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No panels match your search.
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map(panel => (
            <li key={panel.id}>
              <Link
                href={`/panel/${panel.id}`}
                className="flex items-start justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="mr-4 flex min-w-0 flex-1 items-start gap-2">
                  {panel.parentPanelId && (
                    <CornerDownRight
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-label="Follow-up"
                    />
                  )}
                  {!panel.isPublic && !panel.parentPanelId && (
                    <Lock
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                      aria-label="Private"
                    />
                  )}
                  <p className="line-clamp-2 text-sm">{panel.title ?? panel.question}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {panel.personaLabel && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {panel.personaLabel}
                    </span>
                  )}
                  {panel.status === 'complete' && panel.confidence && (
                    <ConfidenceBadge level={panel.confidence} />
                  )}
                  {panel.status === 'running' && (
                    <Badge variant="secondary">Running</Badge>
                  )}
                  {panel.status === 'error' && (
                    <Badge variant="destructive">Error</Badge>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
