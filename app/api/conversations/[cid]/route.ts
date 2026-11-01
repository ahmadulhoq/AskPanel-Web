import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { deleteConversation } from '@/lib/conversations/delete'

export async function DELETE(_request: Request, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await deleteConversation(cid, user.uid))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
