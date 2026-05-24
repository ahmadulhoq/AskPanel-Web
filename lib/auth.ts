import { cookies } from 'next/headers'
import { adminAuth } from '@/lib/firebase/admin'

export const SESSION_COOKIE_NAME = '__session'
export const SESSION_DURATION_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_DURATION_MS,
  })
}

export async function verifySessionCookie(sessionCookie: string) {
  try {
    return await adminAuth().verifySessionCookie(sessionCookie, true)
  } catch {
    return null
  }
}

export async function getSessionUser() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!sessionCookie) return null
  return verifySessionCookie(sessionCookie)
}
