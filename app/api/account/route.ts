import { NextResponse, type NextRequest } from 'next/server'
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth'
import { deleteAccount, AccountDeletionError } from '@/lib/account/delete'

// Permanently deletes the signed-in user's account and data. The body must carry
// { confirm: 'DELETE' } — the account page asks the user to type it.
export async function DELETE(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  if (body?.confirm !== 'DELETE') {
    return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 })
  }

  try {
    await deleteAccount(user.uid)
  } catch (err) {
    if (err instanceof AccountDeletionError) {
      return NextResponse.json({ error: err.message }, { status: 502 })
    }
    throw err
  }
  console.info('[account] deleted', user.uid)

  const response = NextResponse.json({ ok: true })
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
