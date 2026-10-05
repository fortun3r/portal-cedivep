import type { NextRequest } from 'next/server'
import { asSession, COOKIE, cookieOptions, readSigned, safeReturnPath, sign } from '@/lib/auth'
import { CLINIC_NOT_YOURS } from '@/lib/messages'
import { field, readForm, seeOther } from '@/lib/session'

export async function POST(request: NextRequest) {
  const form = await readForm(request)
  if (form instanceof Response) return form
  const s = asSession(readSigned(request.cookies.get(COOKIE.session)?.value))
  if (!s) return seeOther('/')

  const chosen = s.allowedClinics.find((c) => c.code === Number(field(form, 'clinic')))
  // Only a tampered form gets here: a plain 403 is enough.
  if (!chosen) return new Response(CLINIC_NOT_YOURS, { status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

  // Keep the session's original expiry: switching clinics must not extend it.
  const minutesLeft = (s.exp - Date.now()) / 60_000
  const res = seeOther(safeReturnPath(field(form, 'returnTo')) ?? '/pedidos')
  res.cookies.set(COOKIE.session, sign({ allowedClinics: s.allowedClinics, currentClinic: chosen }, minutesLeft),
    cookieOptions(minutesLeft))
  return res
}
