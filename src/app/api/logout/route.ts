import { COOKIE } from '@/lib/auth'
import { seeOther } from '@/lib/session'

export async function POST() {
  const res = seeOther('/')
  res.cookies.delete({ name: COOKIE.session, path: '/' })
  res.cookies.delete({ name: COOKIE.step, path: '/' })
  return res
}
