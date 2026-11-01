// Fixed-window counting, pure so it can be unit tested. The Firestore wrapper is rateLimit.ts.

export interface WindowState {
  count: number
  windowStart: number
}

export interface Limit {
  max: number
  windowMs: number
}

export type WindowDecision =
  | { allowed: true; next: WindowState }
  | { allowed: false; retryAfterMs: number }

export function decide(state: WindowState | null, limit: Limit, now: number): WindowDecision {
  const fresh = !state || now - state.windowStart >= limit.windowMs || now < state.windowStart
  const current = fresh ? { count: 0, windowStart: now } : state
  if (current.count >= limit.max) {
    return { allowed: false, retryAfterMs: current.windowStart + limit.windowMs - now }
  }
  return { allowed: true, next: { count: current.count + 1, windowStart: current.windowStart } }
}
