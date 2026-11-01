'use client'

import { useState, useRef } from 'react'
import { ChevronDown, ChevronUp, Link2, Loader2, Lock, Paperclip } from 'lucide-react'
import { PaywallDialog } from './PaywallDialog'

interface Props {
  tier: 'free' | 'pro'
  value: string
  onChange: (value: string) => void
}

export function ContextInput({ tier, value, onChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [url, setUrl] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [showPaywall, setShowPaywall] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleToggle() {
    if (tier !== 'pro') {
      setShowPaywall(true)
      return
    }
    setExpanded(e => !e)
  }

  async function fetchUrl() {
    const trimmed = url.trim()
    if (!trimmed || fetchingUrl) return
    setFetchingUrl(true)
    setError('')
    try {
      const res = await fetch('/api/context/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to fetch URL')
        return
      }
      const { text } = await res.json()
      onChange(value ? `${value}\n\n${text}` : text)
      setUrl('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setFetchingUrl(false)
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setUploadingFile(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/context/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to read file')
        setFileName('')
        return
      }
      const { text } = await res.json()
      onChange(value ? `${value}\n\n${text}` : text)
    } catch {
      setError('Network error. Please try again.')
      setFileName('')
    } finally {
      setUploadingFile(false)
      // Reset so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const busy = fetchingUrl || uploadingFile

  return (
    <>
      <div className="mb-2">
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {tier !== 'pro' && <Lock className="h-3 w-3" />}
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          Add context
          {tier !== 'pro' && (
            <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-semibold text-primary">
              Pro
            </span>
          )}
        </button>

        {expanded && (
          <div className="mt-2 space-y-2 rounded-xl border border-input bg-muted/30 p-3">
            {/* URL fetch row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="url"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      fetchUrl()
                    }
                  }}
                  placeholder="Paste a URL to extract text…"
                  className="w-full rounded-lg border border-input bg-background py-1.5 pl-8 pr-3 text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
              <button
                type="button"
                onClick={fetchUrl}
                disabled={!url.trim() || busy}
                className="flex items-center gap-1 rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {fetchingUrl ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Fetch'}
              </button>
            </div>

            {/* File upload row */}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                id="context-file-input"
              />
              <label
                htmlFor="context-file-input"
                className={`flex cursor-pointer items-center gap-1.5 rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground ${busy ? 'pointer-events-none opacity-40' : ''}`}
              >
                {uploadingFile ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Paperclip className="h-3 w-3" />
                )}
                {uploadingFile ? 'Reading…' : 'Upload file'}
              </label>
              {fileName && !uploadingFile && (
                <span className="truncate text-xs text-muted-foreground">{fileName}</span>
              )}
              <span className="ml-auto text-xs text-muted-foreground">.txt · .md · .pdf</span>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            {/* Context textarea */}
            <textarea
              rows={3}
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder="Or paste context directly — research, articles, data…"
              className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs leading-relaxed outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
            />

            {value && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{value.length} chars</span>
                <button
                  type="button"
                  onClick={() => { onChange(''); setFileName('') }}
                  className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <PaywallDialog open={showPaywall} onClose={() => setShowPaywall(false)} />
    </>
  )
}
