import 'server-only'
import { config, sessionSecretProblem } from './config'
import { getDb, getDirectory } from './server-state'

/**
 * Runs once when the server starts (instrumentation.ts). Misconfiguration that
 * could expose real data stops the server; a DB that is down only logs, and
 * requests retry lazily.
 */
export async function startup() {
  const problem = sessionSecretProblem()
  if (problem) throw new Error(problem)
  if (!config.isFixtureDb && process.env.NODE_ENV === 'production') {
    if (config.demo) throw new Error('CEDIVEP_DEMO is refused with mysql in production: it shows login codes on screen')
    if (!config.cookieSecure) throw new Error('COOKIE_SECURE must be on with mysql in production')
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
