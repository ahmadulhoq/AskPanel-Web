import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { stopPanel, StopRejected } from '@/lib/panels/stop'

export async function POST(_request: Request, { params }: { params: Promise<{ panelId: string }> }) {
  const { panelId } = await params
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { refunded } = await stopPanel(panelId, user.uid)
    return NextResponse.json({ ok: true, refunded })
  } catch (err) {
    if (err instanceof StopRejected) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    throw err
  }
}
