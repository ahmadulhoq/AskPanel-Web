import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { deletePanel } from '@/lib/panels/delete'
import { setPanelSharing } from '@/lib/panels/share'

// Share or stop sharing a debate: { isPublic: boolean }.
export async function PATCH(request: Request, { params }: { params: Promise<{ panelId: string }> }) {
  const { panelId } = await params
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => null)
  if (typeof body?.isPublic !== 'boolean') {
    return NextResponse.json({ error: 'Expected { isPublic: true | false }' }, { status: 400 })
  }
  if (!(await setPanelSharing(panelId, user.uid, body.isPublic))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ isPublic: body.isPublic })
}

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
