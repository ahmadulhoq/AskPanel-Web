// Context attached to a new conversation's first message, carried from /dashboard to the
// conversation page (too long for the URL). Browser storage can be unavailable (private
// mode, blocked storage): then the context is simply not carried over.
const key = (cid: string) => `askpanel.pendingContext.${cid}`

export function stashPendingContext(cid: string, context: string) {
  try {
    sessionStorage.setItem(key(cid), context)
  } catch {
    // ignore
  }
}

export function takePendingContext(cid: string): string {
  try {
    const value = sessionStorage.getItem(key(cid)) ?? ''
    sessionStorage.removeItem(key(cid))
    return value
  } catch {
    return ''
  }
}
