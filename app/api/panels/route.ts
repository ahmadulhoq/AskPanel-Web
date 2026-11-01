import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createPanel } from '@/lib/panels/create'
import { FreeLimitReachedError } from '@/lib/billing/runs'

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
    throw err
  }
}
