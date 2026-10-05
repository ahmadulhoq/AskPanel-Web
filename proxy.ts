import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth'

// Keep in sync with config.matcher below.
const PROTECTED = ['/dashboard', '/panel', '/account']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Presence check only. Signature/expiry verification happens in server components
  // and route handlers via getSessionUser(), which must still redirect on null.
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/panel/:path*', '/account/:path*'],
}
