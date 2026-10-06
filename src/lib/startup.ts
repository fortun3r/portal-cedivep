import 'server-only'
import { config, sessionSecretProblem } from './config'
import { getDb, getDirectory } from './server-state'

/** Why this config must not serve requests, or null. */
function refusal(): string | null {
  const problem = sessionSecretProblem()
  if (problem) return problem
  if (!config.isFixtureDb && process.env.NODE_ENV === 'production') {
    if (config.demo) return 'CEDIVEP_DEMO is refused with mysql in production: it shows login codes on screen'
    if (!config.cookieSecure) return 'COOKIE_SECURE must be on with mysql in production'
  }
  return null
}

/**
 * Runs once when the server starts (instrumentation.ts). Misconfiguration that
 * could expose real data stops the process (a throw would leave Next listening
 * and answering 500); a DB that is down only logs, and requests retry lazily.
 */
export async function startup() {
  const refused = refusal()
  if (refused) {
    console.error(`\n  CEDIVEP · refusing to start: ${refused}\n`)
    process.exit(1)
  }

  console.log('\n  CEDIVEP · results portal for clinics')
  try {
    const db = await getDb()
    const stats = await (await getDirectory()).load()
    console.log(`  data: ${db.label}${config.isFixtureDb ? ' (demo fixture)' : ''}`)
    console.log(`  clinics: ${stats.clinics} · contacts that can log in: ${stats.contacts}` +
      (stats.shared ? ` · ${stats.shared} shared contacts blocked` : ''))
  } catch (e) {
    console.error('  could not load the clinic directory; will retry on first login:', e)
  }
  if (config.demo) {
    console.log('  DEMO MODE: login codes are shown on screen.')
    if (config.isFixtureDb) console.log('  try phone 0981 000 001 (Clínica Tacuary) or 0981 000 002 (two clinics)')
  }
  console.log('')
}
