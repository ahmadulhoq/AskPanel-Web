// What a new conversation's first message carries besides its text — attached context and
// the options to compare — handed from /dashboard to the conversation page (too long for
// the URL). Browser storage can be unavailable (private mode, blocked storage): then it is
// simply not carried over.
const key = (cid: string) => `askpanel.pendingContext.${cid}`

export interface PendingExtras {
  context: string
  options?: string[]
}

export function stashPendingContext(cid: string, extras: PendingExtras) {
  try {
    sessionStorage.setItem(key(cid), JSON.stringify(extras))
  } catch {
    // ignore
  }
}

export function takePendingContext(cid: string): PendingExtras {
  try {
    const raw = sessionStorage.getItem(key(cid))
    sessionStorage.removeItem(key(cid))
    if (!raw) return { context: '' }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { context: raw } // stashed as plain text by an earlier version
    }
    if (!parsed || typeof parsed !== 'object') return { context: raw }
    const o = parsed as Partial<PendingExtras>
    return {
      context: typeof o.context === 'string' ? o.context : '',
      options: Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === 'string') : undefined,
    }
  } catch {
    return { context: '' }
  }
}
