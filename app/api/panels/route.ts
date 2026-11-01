import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createPanel } from '@/lib/panels/create'
import { panelErrorResponse } from '@/lib/panels/errors'
import { listPanels } from '@/lib/panels/list'

// GET /api/panels?cursor=<next from the previous page> — the next page of the user's panels
// (dashboard "Show more"). Malformed cursors return an empty page.
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await listPanels(user.uid, request.nextUrl.searchParams.get('cursor') ?? undefined))
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { question, isPublic = true, persona, parentPanelId, userContext, maxRounds, mode } = body

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
      mode,
      userContext,
      parentPanelId,
    })
    return NextResponse.json({ panelId })
  } catch (err) {
    const refused = panelErrorResponse(err)
    if (refused) return refused
    throw err
  }
}
