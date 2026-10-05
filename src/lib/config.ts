/**
 * Configuration. Everything that differs between the local demo and the lab's
 * real database lives here and is read from the environment. No credentials in
 * the code: the legacy system has them hardcoded in inicio.prg and compiled into
 * 106 executables; we don't repeat that here.
 */

export type Driver = 'sqlite' | 'mysql'

const env = process.env
const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d)
const bool = (v: string | undefined, d: boolean) => (v === undefined || v === '' ? d : /^(1|true|si|sí|yes)$/i.test(v))

const rawDriver = env.CEDIVEP_DRIVER || 'sqlite'
if (rawDriver !== 'sqlite' && rawDriver !== 'mysql') {
  throw new Error(`CEDIVEP_DRIVER must be "sqlite" or "mysql", got "${rawDriver}"`)
}
const driver: Driver = rawDriver

/**
 * sqlite is always the in-memory fixture (fake data). Both the DB driver and the
 * session-secret fallback branch on this one flag, so a fixed demo secret can
 * never protect real data.
 */
const isFixtureDb = driver === 'sqlite'

/**
 * Demo mode: login codes are shown on screen instead of being sent. On by
 * default only with the fixture. Startup refuses it with mysql in production.
 */
const demo = bool(env.CEDIVEP_DEMO, isFixtureDb)

// ponytail: fixed secret is fine for the fixture DB only; mysql requires SESSION_SECRET.
const FIXTURE_SECRET = 'cedivep-fixture-demo-secret-not-for-real-data'
const MIN_SECRET_LENGTH = 32

/** Problem with SESSION_SECRET for the current driver, or null if it is usable. */
export function sessionSecretProblem(): string | null {
  const s = env.SESSION_SECRET ?? ''
  if (s && s.length < MIN_SECRET_LENGTH) return `SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters`
  if (!s && !isFixtureDb) return 'SESSION_SECRET is required with CEDIVEP_DRIVER=mysql'
  return null
}

/** The cookie signing key. Throws (fail closed) when misconfigured. */
export function sessionSecret(): string {
  const problem = sessionSecretProblem()
  if (problem) throw new Error(problem)
  return env.SESSION_SECRET || FIXTURE_SECRET
}

export const config = {
  driver,
  isFixtureDb,
  demo,

  /** Behind a proxy (Cloudflare Tunnel) to read the real client IP. */
  trustProxy: bool(env.TRUST_PROXY, false),
  /** HTTPS-only cookies. Turn on in production. */
  cookieSecure: bool(env.COOKIE_SECURE, false),
  /** Public origin for links shared outside the portal (WhatsApp). */
  publicUrl: (env.PUBLIC_URL || 'http://localhost:3000').replace(/\/+$/, ''),

  mysql: {
    host: env.DB_HOST ?? '',
    port: num(env.DB_PORT, 3309),
    user: env.DB_USER ?? '',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME ?? 'cedivep',
    connectTimeout: 15_000,
  },

  auth: {
    sessionHours: num(env.SESSION_HOURS, 12),
    /** The "new since your last visit" cookie must outlive sessions by far. */
    visitDays: 365,

    codeMinutes: 10,            // login code lifetime
    codeAttempts: 5,            // attempts to type it right
    codesPerContact: 3,         // codes requested per contact…
    windowMinutes: 15,          // …in this window
    codesPerContactPerDay: 10,  // caps code guessing at ~50 tries per contact per day
    codesPerIp: 20,             // code requests per IP in the window
    maxPendingCodes: 20_000,    // memory bound; applies to known and unknown contacts alike

    /**
     * Clinic codes that are NOT a clinic but a wildcard. In `pedidos`, CLINICA=1
     * means private owners (9 % of orders). Whoever could log in as "clinic 1"
     * would see the results of ALL private owners.
     */
    wildcardClinics: [0, 1] as readonly number[],

    /**
     * One phone or email loaded in many clinics is usually filler data (the lab's
     * own phone, a debt collector's). Above this number nobody can log in with it.
     */
    maxClinicsPerContact: 5,

    /** Business policy, to confirm with the lab. */
    blockDelinquent: bool(env.BLOCK_DELINQUENT, false),
    blockDisabled: bool(env.BLOCK_DISABLED, true),
  },

  /**
   * `descres` sentinel values, VERIFIED against the real database (probe v2,
   * 2026-08-13, 93,460 rows). See docs/01-hallazgos-descres.md.
   */
  sentinels: {
    /** 'S' = section title row (7,379 rows); 'N' = measurement (86,081). */
    isTitle: (v: unknown) => String(v ?? '').trim().toUpperCase() === 'S',
    /** 'N' = outside the reference range (12,609 rows); 'S' = inside (80,851). */
    isOutOfRange: (v: unknown) => String(v ?? '').trim().toUpperCase() === 'N',
    /** Filler values the legacy system stores when there is no data. */
    empty: new Set(['', '0', 'SIN PELAJE', 'SS', 'S/D', '0000-00-00']),
  },

  lab: {
    name: 'CEDIVEP S.R.L.',
    subtitle: 'Centro de Diagnóstico Veterinario del Paraguay',
    accreditation: '114-SENACSA',
    // From cedivep.com.py; pending confirmation with the lab (DISENO §7.4).
    phone: '(021) 584 085',
    email: 'info.cedivep@cedivep.com.py',
    hours: 'Lunes a viernes 7:00–18:00 · Sábado 7:00–12:00',
  },
} as const
