import { Timestamp, type Transaction } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { decide, type Limit, type WindowState } from './window'

// Abuse protection per account, separate from plan allowances (free runs, daily replies).
// Generous for people, tight enough to cap the cost of a script hammering an endpoint.
// (Not per IP: behind Google's front end the client-supplied X-Forwarded-For can't be
// trusted without knowing the proxy chain, and shared IPs would lock out real users.)
export const LIMITS = {
  debate: { max: 20, windowMs: 60 * 60 * 1000 },     // debates started or retried, per hour
  reply: { max: 20, windowMs: 60 * 1000 },           // quick replies, per minute
  context: { max: 30, windowMs: 60 * 60 * 1000 },    // URL fetches + file extractions, per hour
  session: { max: 30, windowMs: 10 * 60 * 1000 },    // session cookies issued, per 10 minutes
} satisfies Record<string, Limit>

export type LimitName = keyof typeof LIMITS

export class RateLimitedError extends Error {
  readonly retryAfterSeconds: number
  constructor(retryAfterMs: number) {
    super('RATE_LIMITED')
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))
  }
}

const limitRef = (name: LimitName, uid: string) => adminDb().collection('rateLimits').doc(`${name}:${uid}`)

// Checks the limit inside the caller's transaction (a read — do it before the transaction's
// writes) and returns the write that counts the request. Call that with the other writes,
// so a request that fails later in the same transaction (e.g. out of free runs) isn't
// counted. Throws RateLimitedError when over the limit.
export async function limitInTransaction(tx: Transaction, name: LimitName, uid: string, now = Date.now()) {
  const limit = LIMITS[name]
  const ref = limitRef(name, uid)
  const data = (await tx.get(ref)).data() as WindowState | undefined
  const decision = decide(data ? { count: data.count, windowStart: data.windowStart } : null, limit, now)
  if (!decision.allowed) throw new RateLimitedError(decision.retryAfterMs)
  // `expiresAt` is for a Firestore TTL policy; `uid` lets account deletion find the doc.
  return () => {
    tx.set(ref, { ...decision.next, uid, expiresAt: Timestamp.fromMillis(decision.next.windowStart + limit.windowMs) })
  }
}

// Counts one request on its own. Throws RateLimitedError when over the limit.
export async function rateLimit(name: LimitName, uid: string) {
  await adminDb().runTransaction(async (tx) => (await limitInTransaction(tx, name, uid))())
}

export function rateLimitedResponse(err: RateLimitedError) {
  return Response.json(
    { error: `Too many requests. Try again in ${err.retryAfterSeconds} seconds.` },
    { status: 429, headers: { 'Retry-After': String(err.retryAfterSeconds) } },
  )
}

// For route handlers: a 429 response when over the limit, otherwise null.
export async function limitResponse(name: LimitName, uid: string): Promise<Response | null> {
  try {
    await rateLimit(name, uid)
    return null
  } catch (err) {
    if (err instanceof RateLimitedError) return rateLimitedResponse(err)
    throw err
  }
}
