import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createPanel } from '@/lib/panels/create'
import { listPanels } from '@/lib/panels/list'
import { FreeLimitReachedError } from '@/lib/billing/runs'
import { RateLimitedError, rateLimitedResponse } from '@/lib/limits/rateLimit'

// GET /api/panels?after=<panelId> — the next page of the user's panels (dashboard "Show more").
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const after = request.nextUrl.searchParams.get('after')
  const afterId = after && /^[A-Za-z0-9_-]{1,64}$/.test(after) ? after : undefined
  return NextResponse.json(await listPanels(user.uid, afterId))
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { question, isPublic = true, persona, parentPanelId, userContext, maxRounds } = body

  if (!question || typeof question !== 'string' || question.trim().length < 10) {
    return NextResponse.json({ error: 'Question must be at least 10 characters' }, { status: 400 })
  }

  try {
    const panelId = await createPanel({
      uid: user.uid,
      question,
      isPublic: isPublic === true,
      persona,
      maxRounds,
      userContext,
      parentPanelId,
    })
    return NextResponse.json({ panelId })
  } catch (err) {
    if (err instanceof FreeLimitReachedError) {
      return NextResponse.json({ error: 'FREE_LIMIT_REACHED' }, { status: 402 })
    }
    if (err instanceof RateLimitedError) return rateLimitedResponse(err)
    throw err
  }
}
