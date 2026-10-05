import { NextResponse, type NextRequest } from 'next/server'
import { asSession, COOKIE, cookieOptions, readSigned, sign } from './lib/auth'
import { config as app } from './lib/config'
import { asVisits, recordVisit, todayPy } from './lib/orders'

/**
 * Content Security Policy with a per-request nonce (Next's recipe): Next reads
 * the nonce from the request header and puts it on its own scripts. Also
 * records today's visit to /pedidos for the "nuevo" badges, since pages can't
 * write cookies.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const dev = process.env.NODE_ENV === 'development'
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Dev tools inject styles; a nonce would make the browser ignore 'unsafe-inline'.
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(app.cookieSecure ? ['upgrade-insecure-requests'] : []),
  ].join('; ')

  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)
  const response = NextResponse.next({ request: { headers } })
  response.headers.set('content-security-policy', csp)

  if (request.method === 'GET' && request.nextUrl.pathname === '/pedidos') recordTodaysVisit(request, response)
  return response
}

function recordTodaysVisit(request: NextRequest, response: NextResponse) {
  try {
    const clinic = asSession(readSigned(request.cookies.get(COOKIE.session)?.value))?.currentClinic
    if (!clinic) return
    const visits = asVisits(readSigned(request.cookies.get(COOKIE.visit)?.value))
    const today = todayPy()
    if (visits[String(clinic.code)]?.[1] === today) return
    const minutes = app.auth.visitDays * 24 * 60
    response.cookies.set(COOKIE.visit, sign({ visits: recordVisit(visits, clinic.code, today).visits }, minutes),
      cookieOptions(minutes))
  } catch (e) {
    console.error('[proxy] could not record the visit', e)
  }
}

export const config = {
  matcher: [{
    source: '/((?!api|health|_next/static|_next/image|favicon.ico).*)',
    missing: [
      { type: 'header', key: 'next-router-prefetch' },
      { type: 'header', key: 'purpose', value: 'prefetch' },
    ],
  }],
}
