/**
 * Normalization of phones and emails as they are loaded in `clini_vet`.
 *
 * Real data is dirty (probe v4): '0986 441 190', '981914102',
 * '981-114.114 - 754.278' (two numbers in one field), emails with two
 * addresses separated by a comma, phones inside the email field.
 * Everything that gets compared goes through here.
 */

/**
 * Separators between TWO different numbers in the same field: slash, comma,
 * ' - ' with spaces, double space ('0981.409495  0343 - 420 984'), 'y', 'o'.
 * A single space does NOT separate: '0981 163 342' is one number.
 */
const BETWEEN_NUMBERS = /\s*[\/,;|]\s*|\s+-\s+|\s{2,}|\s+y\s+|\s+o\s+/i

/**
 * Canonical form of a Paraguayan phone: digits only, without +595 or the
 * leading 0. A mobile ends up as 9 digits ('981163342'), an Asunción landline
 * as 8 ('21123456'). Returns null if it doesn't look like a full phone.
 */
export function canonicalPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00595')) d = d.slice(5)
  else if (d.startsWith('595') && d.length >= 11) d = d.slice(3)
  d = d.replace(/^0+/, '')
  if (d.length < 8 || d.length > 9) return null
  if (/^(\d)\1+$/.test(d)) return null // 999999999, 00000000…
  return d
}

/** Every valid phone found in a free-text field. */
export function phonesIn(raw: string | null | undefined): string[] {
  if (!raw) return []
  const out = new Set<string>()
  for (const part of String(raw).split(BETWEEN_NUMBERS)) {
    const t = canonicalPhone(part)
    if (t) out.add(t)
  }
  return [...out]
}

const EMAIL = /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/gi

/** Every email found in a free-text field, lowercased. */
export function emailsIn(raw: string | null | undefined): string[] {
  if (!raw) return []
  return [...new Set((String(raw).match(EMAIL) ?? []).map((e) => e.toLowerCase()))]
}

/**
 * What the user types at login, in the same canonical form.
 * Returns the lookup key, or null if it's neither an email nor a phone.
 */
export function contactKey(input: string): string | null {
  const s = input.trim()
  if (s.includes('@')) {
    const [c] = emailsIn(s)
    return c ? `mail:${c}` : null
  }
  const t = canonicalPhone(s)
  return t ? `tel:${t}` : null
}

/** For logs: never the full contact. */
export function maskContact(key: string): string {
  const [kind, v] = key.split(':')
  if (kind === 'tel') return `tel:…${v.slice(-3)}`
  const [user, domain] = v.split('@')
  return `mail:${user.slice(0, 2)}…@${domain}`
}

/** Where the code was "sent", as shown on /verificar. Masked either way. */
export function visibleDestination(key: string): string {
  const [kind, v] = key.split(':')
  if (kind === 'tel') return `el celular terminado en ${v.slice(-3)}`
  const [user, domain] = v.split('@')
  return `el correo ${user.slice(0, 1)}•••@${domain}`
}
