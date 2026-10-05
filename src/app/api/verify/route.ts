import type { NextRequest } from 'next/server'
import { asStep, COOKIE, cookieOptions, readSigned, sign, type Session } from '@/lib/auth'
import { config } from '@/lib/config'
import { maskContact } from '@/lib/contact'
import { getLoginCodes } from '@/lib/server-state'
import { field, readForm, seeOther, volverQuery } from '@/lib/session'

const A = config.auth

export async function POST(request: NextRequest) {
  const form = await readForm(request)
  if (form instanceof Response) return form
  const step = asStep(readSigned(request.cookies.get(COOKIE.step)?.value))
  if (!step) return seeOther('/')

  const r = getLoginCodes().verify(step.key, field(form, 'code').slice(0, 20))
  if (!r.ok) {
    if (r.reason === 'incorrect') return seeOther('/verificar?error=incorrecto')
    // The code is gone: stop showing it (demo), keep the step so "Reenviar" works.
    const res = seeOther('/verificar?error=vencido')
    res.cookies.set(COOKIE.step, sign({ key: step.key, ...(step.returnTo ? { returnTo: step.returnTo } : {}) },
      A.codeMinutes + 5), cookieOptions(A.codeMinutes + 5))
    return res
  }

  const session: Omit<Session, 'exp'> = {
    allowedClinics: r.clinics,
    ...(r.clinics.length === 1 ? { currentClinic: r.clinics[0] } : {}),
  }
  console.log(`[login] ok ${maskContact(step.key)} → ${r.clinics.map((c) => c.code).join(',')}`)
  const res = seeOther(session.currentClinic ? step.returnTo ?? '/pedidos' : `/elegir${volverQuery(step.returnTo)}`)
  res.cookies.delete({ name: COOKIE.step, path: '/' })
  res.cookies.set(COOKIE.session, sign(session, A.sessionHours * 60), cookieOptions(A.sessionHours * 60))
  return res
}
