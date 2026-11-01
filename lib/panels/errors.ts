import { NextResponse } from 'next/server'
import { FreeLimitReachedError } from '@/lib/billing/runs'
import { RateLimitedError, rateLimitedResponse } from '@/lib/limits/rateLimit'

// The HTTP answer for createPanel's expected refusals; null for anything else (rethrow it).
export function panelErrorResponse(err: unknown): Response | null {
  if (err instanceof FreeLimitReachedError) return NextResponse.json({ error: 'FREE_LIMIT_REACHED' }, { status: 402 })
  if (err instanceof RateLimitedError) return rateLimitedResponse(err)
  return null
}
