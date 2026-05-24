import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth'

// Routes requiring auth
const PROTECTED = ['/dashboard', '/panel']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED.some(p => pathname.startsWith(p))
  if (!isProtected) return NextResponse.next()

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Lightweight check: verify cookie exists and is non-empty.
  // Full signature verification happens in API routes and server components
  // via firebase-admin (we avoid importing it in middleware to keep edge bundle small).
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/panel/:path*'],
}
