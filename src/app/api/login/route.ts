import type { NextRequest } from 'next/server'
import { asStep, clientIp, COOKIE, cookieOptions, readSigned, safeReturnPath, sign } from '@/lib/auth'
import { config } from '@/lib/config'
import { contactKey, maskContact } from '@/lib/contact'
import { consoleNotifier } from '@/lib/notify'
import { getDirectory, getLoginCodes } from '@/lib/server-state'
import { field, readForm, seeOther, withQuery } from '@/lib/session'

const A = config.auth
const FLASH_MINUTES = 1

/**
 * Asks for a login code (also "Reenviar código", with resend=1). The answer is
 * the same whether or not the contact is registered: we never reveal who is.
 */
export async function POST(request: NextRequest) {
  const form = await readForm(request)
  if (form instanceof Response) return form

  const resend = field(form, 'resend') === '1'
  let key: string | null
  let returnTo: string | null
  let typed = ''
  if (resend) {
    // The contact comes ONLY from the signed step cookie, never from the form.
    const step = asStep(readSigned(request.cookies.get(COOKIE.step)?.value))
    if (!step) return seeOther('/')
    key = step.key
    returnTo = step.returnTo ?? null
  } else {
    typed = Array.from(field(form, 'contact')).slice(0, 200).join('')  // whole code points: a cookie can't hold half an emoji
    returnTo = safeReturnPath(field(form, 'returnTo'))
    key = contactKey(typed)
  }

  const failure = (error: 'formato' | 'limite' | 'inesperado') => {
    if (resend) return seeOther(withQuery('/verificar', { error }))
    const res = seeOther(withQuery('/', { error, volver: returnTo }))
    res.cookies.set(COOKIE.flash, typed, cookieOptions(FLASH_MINUTES))
    return res
  }
  if (!key) return failure('formato')

  const codes = getLoginCodes()
  const ip = clientIp(request.headers)
  const blocked = codes.admit(key, ip)
  if (blocked) {
    console.warn(`[login] limit ${blocked.ok ? '' : blocked.reason} ${maskContact(key)} ip=${ip}`)
    return failure('limite')
  }

  let lookup
  try {
    lookup = await (await getDirectory()).lookup(key)
  } catch (e) {
    console.error('[login] clinic directory unavailable', e)
    return failure('inesperado')
  }
  const { clinics, reason } = lookup
  const issued = codes.issue(key, clinics)
  if (!issued.ok) {
    console.warn(`[login] limit ${issued.reason} ${maskContact(key)} ip=${ip}`)
    return failure('limite')
  }
  let demo: string | undefined
  if (clinics.length) {
    // Not awaited: response time must not depend on whether the contact exists.
    consoleNotifier.send(key, issued.code, clinics)
      .catch((e) => console.error(`[login] could not send the code to ${maskContact(key)}`, e))
    if (config.demo) demo = issued.code
  } else {
    console.log(`[login] no access ${maskContact(key)} (${reason})`)
  }

  const minutes = A.codeMinutes + 5
  const res = seeOther('/verificar')
  res.cookies.set(COOKIE.step, sign({ key, ...(returnTo ? { returnTo } : {}), ...(demo ? { demo } : {}) }, minutes),
    cookieOptions(minutes))
  res.cookies.delete({ name: COOKIE.flash, path: '/' })
  return res
}
