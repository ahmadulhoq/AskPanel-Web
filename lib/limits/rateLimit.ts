import { createHash } from 'node:crypto'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase/admin'
import { decide, type Limit, type WindowState } from './window'

// Abuse protection, separate from plan allowances (free runs, daily replies). Generous for
// people, tight enough to cap the cost of a script hammering an endpoint.
export const LIMITS = {
  debate: { max: 20, windowMs: 60 * 60 * 1000 },     // debates started (any tier), per hour
  reply: { max: 20, windowMs: 60 * 1000 },           // quick replies, per minute
  context: { max: 30, windowMs: 60 * 60 * 1000 },    // URL fetches + file extractions, per hour
  session: { max: 30, windowMs: 10 * 60 * 1000 },    // sign-ins per IP, per 10 minutes
} satisfies Record<string, Limit>

export type LimitName = keyof typeof LIMITS

export class RateLimitedError extends Error {
  readonly retryAfterSeconds: number
  constructor(retryAfterMs: number) {
    super('RATE_LIMITED')
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))
  }
}

// Counts one request against `name` for `subject` (a uid, or an IP for sign-in) in a
// Firestore fixed window. Throws RateLimitedError when over the limit. Docs carry
// `expiresAt` for a Firestore TTL policy, and `uid` so account deletion can find them.
export async function rateLimit(name: LimitName, subject: { uid: string } | { ip: string }) {
  const limit = LIMITS[name]
  // IPs are stored hashed, never raw.
  const key = 'uid' in subject
    ? `${name}:${subject.uid}`
    : `${name}:ip:${createHash('sha256').update(subject.ip).digest('hex').slice(0, 32)}`
  const db = adminDb()
  const ref = db.collection('rateLimits').doc(key)
  const now = Date.now()

  const result = await db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data() as (WindowState & { expiresAt?: Timestamp }) | undefined
    const decision = decide(data ? { count: data.count, windowStart: data.windowStart } : null, limit, now)
    if (!decision.allowed) return decision
    tx.set(ref, {
      ...decision.next,
      ...('uid' in subject ? { uid: subject.uid } : {}),
      expiresAt: Timestamp.fromMillis(decision.next.windowStart + limit.windowMs),
    })
    return decision
  })
  if (!result.allowed) throw new RateLimitedError(result.retryAfterMs)
}

// Client IP as App Hosting (Cloud Run) forwards it.
export function clientIp(headers: Headers): string {
  return headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}

export function rateLimitedResponse(err: RateLimitedError) {
  return Response.json(
    { error: `Too many requests. Try again in ${err.retryAfterSeconds} seconds.` },
    { status: 429, headers: { 'Retry-After': String(err.retryAfterSeconds) } },
  )
}
