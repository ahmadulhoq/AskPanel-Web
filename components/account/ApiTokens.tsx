'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ApiTokenView } from '@/lib/mcp/tokens'

interface Props {
  initialTokens: ApiTokenView[]
  mcpUrl: string
}

function formatDate(ms: number | null) {
  return ms ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'never'
}

// Personal API tokens for the MCP server: create (shown once), list, revoke.
export function ApiTokens({ initialTokens, mcpUrl }: Props) {
  const [tokens, setTokens] = useState(initialTokens)
  const [name, setName] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/account/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Could not create a token.')
        return
      }
      setCreated(data.token)
      setTokens((all) => [data.view, ...all])
      setName('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(id: string) {
    setError('')
    const res = await fetch(`/api/account/tokens/${id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) setTokens((all) => all.filter((t) => t.id !== id))
    else setError('Could not revoke the token.')
  }

  const claudeCode = created
    ? `claude mcp add --transport http askpanel ${mcpUrl} --header "Authorization: Bearer ${created}"`
    : ''

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Use AskPanel from Claude Code, Cursor and other MCP clients: start debates and get their verdicts without
        leaving your editor. Debates started there count against your plan and show up in your conversations.
      </p>

      {created && (
        <div className="space-y-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
          <p className="font-medium">Copy your token now — it won&apos;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded bg-background px-2 py-1 font-mono text-xs" data-token>{created}</code>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(created)
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Copy token"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Claude Code:</p>
          <code className="block break-all rounded bg-background px-2 py-1 font-mono text-xs">{claudeCode}</code>
          <p className="text-xs text-muted-foreground">
            Other clients: server URL <code className="font-mono">{mcpUrl}</code> with the header{' '}
            <code className="font-mono">Authorization: Bearer &lt;token&gt;</code>.
          </p>
        </div>
      )}

      {tokens.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{t.hint}</span> · created {formatDate(t.createdAt)} · last used {formatDate(t.lastUsedAt)}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => revoke(t.id)} className="text-destructive hover:text-destructive">
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          placeholder="Token name, e.g. Claude Code on my laptop"
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
        />
        <Button onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create token'}</Button>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  )
}
