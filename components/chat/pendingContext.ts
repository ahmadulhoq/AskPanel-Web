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
    const parsed = raw ? (JSON.parse(raw) as Partial<PendingExtras>) : {}
    return {
      context: typeof parsed.context === 'string' ? parsed.context : '',
      options: Array.isArray(parsed.options) ? parsed.options.filter((o): o is string => typeof o === 'string') : undefined,
    }
  } catch {
    return { context: '' }
  }
}
