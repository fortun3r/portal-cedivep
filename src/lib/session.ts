/**
 * Request-side helpers: reading the signed cookies in pages, guarding pages,
 * and building the 303 responses of the POST handlers.
 */
import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { asSession, asStep, COOKIE, readSigned, type CodeStep, type Session } from './auth'
import { config } from './config'
import { asVisits, type Visits } from './orders'
import type { Clinic } from './types'

export async function readSession(): Promise<Session | null> {
  return asSession(readSigned((await cookies()).get(COOKIE.session)?.value))
}

export async function readStep(): Promise<CodeStep | null> {
  return asStep(readSigned((await cookies()).get(COOKIE.step)?.value))
}

export async function readVisits(): Promise<Visits> {
  return asVisits(readSigned((await cookies()).get(COOKIE.visit)?.value))
}

/** The session's current clinic, if it is a real clinic the session may enter. */
export function currentClinic(s: Session): Clinic | null {
  const c = s.currentClinic
  if (!c || config.auth.wildcardClinics.includes(c.code)) return null
  return s.allowedClinics.some((a) => a.code === c.code) ? c : null
}

/** `?volver=` query string for a validated return path ('' when there is none). */
export const volverQuery = (returnTo: string | null | undefined) =>
  returnTo ? `?${new URLSearchParams({ volver: returnTo })}` : ''

/**
 * Guard for the pages under /pedidos. No session → login (coming back to
 * `returnTo` afterwards); no clinic chosen yet → the clinic picker.
 */
export async function requireClinic(returnTo?: string | null): Promise<{ session: Session; clinic: Clinic }> {
  const session = await readSession()
  if (!session) redirect(`/${volverQuery(returnTo)}`)
  const clinic = currentClinic(session)
  if (!clinic) redirect(session.currentClinic ? '/' : `/elegir${volverQuery(returnTo)}`)
  return { session, clinic }
}

/** First value of a search param. */
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export type SearchParams = Promise<Record<string, string | string[] | undefined>>

// ───────────────────────────────────────────── POST handlers

/**
 * 303 with a RELATIVE Location. Not NextResponse.redirect (needs an absolute
 * URL, and request.url says localhost behind the tunnel) nor redirect() (307:
 * the browser would re-POST).
 */
export function seeOther(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } })
}

/** Path with query params, skipping empty values. */
export function withQuery(path: string, params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v)
  const s = q.toString()
  return s ? `${path}?${s}` : path
}

const MAX_BODY = 2048

/**
 * Reads an HTML form post. Bodies over 2 KB, or without a Content-Length
 * (chunked), are refused: Route Handlers have no body limit of their own.
 */
export async function readForm(request: Request): Promise<FormData | Response> {
  const length = request.headers.get('content-length')
  if (length === null || !(Number(length) <= MAX_BODY)) return new Response('Payload too large', { status: 413 })
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) {
    return new Response('Bad request', { status: 400 })
  }
  try {
    return await request.formData()
  } catch {
    return new Response('Bad request', { status: 400 })
  }
}

export function field(form: FormData, name: string): string {
  const v = form.get(name)
  return typeof v === 'string' ? v : ''
}
