import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminDb } from '@/lib/firebase/admin'

const MAX_LABEL = 40
const MAX_SYSTEM_PROMPT = 2000

export async function PUT(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = adminDb()
  const userSnap = await db.collection('users').doc(user.uid).get()
  const tier = userSnap.data()?.subscription?.tier ?? 'free'
  if (tier !== 'pro') {
    return NextResponse.json({ error: 'Pro subscription required' }, { status: 403 })
  }

  const body = await request.json()
  const { label, respondentSystem, criticSystem } = body

  if (!label || typeof label !== 'string' || label.trim().length === 0) {
    return NextResponse.json({ error: 'Label is required' }, { status: 400 })
  }
  if (!respondentSystem || typeof respondentSystem !== 'string' || respondentSystem.trim().length < 20) {
    return NextResponse.json({ error: 'Respondent prompt must be at least 20 characters' }, { status: 400 })
  }
  if (!criticSystem || typeof criticSystem !== 'string' || criticSystem.trim().length < 20) {
    return NextResponse.json({ error: 'Critic prompt must be at least 20 characters' }, { status: 400 })
  }

  const customPersona = {
    label: label.trim().slice(0, MAX_LABEL),
    respondentSystem: respondentSystem.trim().slice(0, MAX_SYSTEM_PROMPT),
    criticSystem: criticSystem.trim().slice(0, MAX_SYSTEM_PROMPT),
  }

  await db.collection('users').doc(user.uid).update({ customPersona })

  return NextResponse.json({ ok: true, customPersona })
}

export async function DELETE(_request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await adminDb().collection('users').doc(user.uid).update({ customPersona: null })
  return NextResponse.json({ ok: true })
}
