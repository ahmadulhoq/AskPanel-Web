import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { deletePanel } from '@/lib/panels/delete'

export async function DELETE(_request: Request, { params }: { params: Promise<{ panelId: string }> }) {
  const { panelId } = await params
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!(await deletePanel(panelId, user.uid))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
