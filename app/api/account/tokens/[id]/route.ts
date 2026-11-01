import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { revokeApiToken } from '@/lib/mcp/tokens'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await revokeApiToken(user.uid, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  console.info('[account] API token revoked', user.uid)
  return NextResponse.json({ ok: true })
}
