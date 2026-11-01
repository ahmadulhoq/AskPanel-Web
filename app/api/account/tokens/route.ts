import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { createApiToken, listApiTokens, TokenLimitError } from '@/lib/mcp/tokens'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ tokens: await listApiTokens(user.uid) })
}

// Creates a personal API token. The response is the only time the token is shown.
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  try {
    const { token, view } = await createApiToken(user.uid, body.name)
    console.info('[account] API token created', user.uid, view.hint)
    return NextResponse.json({ token, view })
  } catch (err) {
    if (err instanceof TokenLimitError) return NextResponse.json({ error: err.message }, { status: 409 })
    throw err
  }
}
