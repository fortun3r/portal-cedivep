/**
 * Passwordless login: the clinic types its phone or email, receives a 6-digit
 * code, types it and is in.
 *
 * Why not passwords: there are 4,312 clinics, and the precedent in the house
 * (cobrador.CLAVE) is a single '1234' password shared by everyone. A one-time
 * code doesn't need to be managed, remembered or reset.
 *
 * Everything lives in process memory: codes and rate limits. The session goes
 * in an HMAC-signed cookie, so the server keeps no session state and the lab's
 * database stays read-only.
 * ponytail: in-memory store, one process only; move codes/limits to Redis if the portal ever runs on more than one instance.
 */
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { config, sessionSecret } from './config'
import type { Clinic } from './types'

const A = config.auth
const now = () => Date.now()
const sha = (s: string) => createHash('sha256').update(s).digest()

// ─────────────────────────────────────────────────── rate limits

/** Event counter over a sliding window. */
export class RateLimit {
  private events = new Map<string, number[]>()
  constructor(private max: number, private windowMs: number) {}

  /** Records an attempt. Returns false if the limit was already reached. */
  allow(key: string): boolean {
    const since = now() - this.windowMs
    const evs = (this.events.get(key) ?? []).filter((t) => t > since)
    if (evs.length >= this.max) {
      this.events.set(key, evs)
      return false
    }
    evs.push(now())
    this.events.set(key, evs)
    return true
  }

  cleanup() {
    const since = now() - this.windowMs
    for (const [k, evs] of this.events) {
      const alive = evs.filter((t) => t > since)
      if (alive.length) this.events.set(k, alive)
      else this.events.delete(k)
    }
  }
}

// ─────────────────────────────────────────────────── login codes

interface PendingCode {
  hash: Buffer
  clinics: Clinic[]
  expires: number
  attempts: number
}

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'limit_contact' | 'limit_ip' | 'limit_daily' | 'capacity' }

export type VerifyResult =
  | { ok: true; clinics: Clinic[] }
  | { ok: false; reason: 'no_code' | 'expired' | 'incorrect' | 'exhausted' }

export class LoginCodes {
  private pending = new Map<string, PendingCode>()
  readonly perContact = new RateLimit(A.codesPerContact, A.windowMinutes * 60_000)
  readonly perContactDaily = new RateLimit(A.codesPerContactPerDay, 24 * 60 * 60_000)
  readonly perIp = new RateLimit(A.codesPerIp, A.windowMinutes * 60_000)

  /**
   * Checks the rate limits. Called ALWAYS, whether or not the contact exists,
   * so the limits don't reveal which contacts are registered.
   */
  admit(key: string, ip: string): IssueResult | null {
    if (!this.perIp.allow(ip)) return { ok: false, reason: 'limit_ip' }
    if (!this.perContact.allow(key)) return { ok: false, reason: 'limit_contact' }
    if (!this.perContactDaily.allow(key)) return { ok: false, reason: 'limit_daily' }
    return null
  }

  /**
   * Issues a new code for that contact (invalidates the previous one). Unknown
   * contacts get one too, with no clinics, so a wrong code behaves the same
   * whether or not the contact is registered.
   */
  issue(key: string, clinics: Clinic[]): IssueResult {
    if (this.pending.size >= A.maxPendingCodes && !this.pending.has(key)) {
      return { ok: false, reason: 'capacity' }
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    this.pending.set(key, {
      hash: sha(`${key}|${code}`),
      clinics,
      expires: now() + A.codeMinutes * 60_000,
      attempts: 0,
    })
    return { ok: true, code }
  }

  verify(key: string, code: string): VerifyResult {
    const p = this.pending.get(key)
    if (!p) return { ok: false, reason: 'no_code' }
    if (now() > p.expires) {
      this.pending.delete(key)
      return { ok: false, reason: 'expired' }
    }
    p.attempts++
    const digits = code.replace(/\D/g, '')
    const matches = digits.length === 6 && timingSafeEqual(sha(`${key}|${digits}`), p.hash)
    // A contact with no clinics can't log in even with the right code.
    if (matches && p.clinics.length) {
      this.pending.delete(key)        // single use
      return { ok: true, clinics: p.clinics }
    }
    if (p.attempts >= A.codeAttempts) {
      this.pending.delete(key)
      return { ok: false, reason: 'exhausted' }
    }
    return { ok: false, reason: 'incorrect' }
  }

  /** Maintenance: drops what expired. Runs every few minutes. */
  cleanup() {
    for (const [k, p] of this.pending) if (now() > p.expires) this.pending.delete(k)
    this.perContact.cleanup()
    this.perContactDaily.cleanup()
    this.perIp.cleanup()
  }
}

// ─────────────────────────────────────────────────── signed cookies

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')
const hmac = (s: string) => createHmac('sha256', sessionSecret()).update(s).digest()

export function sign(data: object, minutes: number): string {
  const body = b64(JSON.stringify({ ...data, exp: now() + minutes * 60_000 }))
  return `${body}.${b64(hmac(body))}`
}

export function readSigned(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null
  const [body, signature] = value.split('.')
  if (!body || !signature) return null
  const expected = hmac(body)
  const received = Buffer.from(signature, 'base64url')
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof data !== 'object' || data === null || typeof data.exp !== 'number' || now() > data.exp) return null
    return data
  } catch {
    return null
  }
}

/** The session: which clinics it may enter and which one it is in. */
export interface Session {
  allowedClinics: Clinic[]
  currentClinic?: Clinic
  exp: number
}

/** The step between asking for the code and typing it. */
export interface CodeStep {
  key: string
  returnTo?: string
  /** Demo mode only: the code, to show it on screen. */
  demo?: string
}

const isClinic = (c: unknown): c is Clinic =>
  typeof c === 'object' && c !== null
  && Number.isInteger((c as Clinic).code) && typeof (c as Clinic).name === 'string'

/** Shape-checks a signed session (a step cookie pasted as a session must not pass). */
export function asSession(data: Record<string, unknown> | null): Session | null {
  if (!data || !Array.isArray(data.allowedClinics) || !data.allowedClinics.length) return null
  if (!data.allowedClinics.every(isClinic)) return null
  if (data.currentClinic !== undefined && !isClinic(data.currentClinic)) return null
  return data as unknown as Session
}

export function asStep(data: Record<string, unknown> | null): CodeStep | null {
  if (!data || typeof data.key !== 'string' || !/^(tel|mail):./.test(data.key)) return null
  return {
    key: data.key,
    returnTo: safeReturnPath(data.returnTo) ?? undefined,
    demo: typeof data.demo === 'string' ? data.demo : undefined,
  }
}

// ─────────────────────────────────────────────────── redirects and client IP

const RETURN_PATH = /^\/pedidos\/\d{4}-\d{2}-\d{2}\/[1-9]\d{0,8}(\?hallazgos=1)?$/

/**
 * Where to send someone after login (`?volver=`). Only a report URL of this
 * portal: anything else (external, protocol-relative, traversal, encoded) is
 * dropped. Return the validated string as is, never a normalized version.
 */
export function safeReturnPath(v: unknown): string | null {
  return typeof v === 'string' && RETURN_PATH.test(v) ? v : null
}

/**
 * The client IP for rate limiting. IPv6 is keyed by its /64: one host usually
 * owns a whole /64, and per-address keys would give it unlimited budgets.
 * ponytail: spoofable unless Next listens on 127.0.0.1 behind cloudflared (TRUST_PROXY); the per-contact limits are the real control.
 */
export function clientIp(headers: Headers): string {
  const ip = ((config.trustProxy && headers.get('cf-connecting-ip'))
    || headers.get('x-forwarded-for')?.split(',').at(-1)
    || '?').trim().replace(/^::ffff:/, '')
  if (!ip.includes(':')) return ip
  const [head, tail = ''] = ip.split('::')
  const a = head ? head.split(':') : []
  const b = tail ? tail.split(':') : []
  const full = [...a, ...Array(Math.max(0, 8 - a.length - b.length)).fill('0'), ...b]
  return `${full.slice(0, 4).map((h) => h.toLowerCase().replace(/^0+(?=.)/, '')).join(':')}::/64`
}

// ─────────────────────────────────────────────────── cookies

export const COOKIE = {
  step: 'cedivep_step',
  session: 'cedivep_session',
  visit: 'cedivep_visit',
  flash: 'cedivep_flash',
} as const

/** Next's maxAge is in SECONDS (Express used milliseconds). */
export const cookieOptions = (minutes: number) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: config.cookieSecure,
  path: '/',
  maxAge: Math.max(0, Math.floor(minutes * 60)),
})
