/**
 * Process-wide objects: the DB, the clinic directory and the pending login
 * codes. They live on globalThis because Next may evaluate a module once per
 * route bundle, and dev hot reload re-evaluates it: a module-level `new
 * LoginCodes()` would lose pending codes or split them between /api/login and
 * /api/verify. Everything is created lazily, so `next build` never opens the DB.
 */
import 'server-only'
import { LoginCodes } from './auth'
import { openDb, type Db } from './db'
import { ClinicDirectory, diagnostics } from './repo'

interface State {
  db?: Promise<Db>
  directory?: Promise<ClinicDirectory>
  codes?: LoginCodes
  health?: { at: number; value: Promise<Awaited<ReturnType<typeof diagnostics>>> }
}

const KEY = Symbol.for('cedivep.server-state')
const g = globalThis as typeof globalThis & { [KEY]?: State }
const state: State = (g[KEY] ??= {})

export function getDb(): Promise<Db> {
  // A failed connection is not cached: the next request retries.
  state.db ??= openDb().catch((e) => { state.db = undefined; throw e })
  return state.db
}

export function getDirectory(): Promise<ClinicDirectory> {
  state.directory ??= getDb().then((db) => new ClinicDirectory(db))
    .catch((e) => { state.directory = undefined; throw e })
  return state.directory
}

export function getLoginCodes(): LoginCodes {
  if (!state.codes) {
    const codes = new LoginCodes()
    setInterval(() => codes.cleanup(), 5 * 60_000).unref()
    state.codes = codes
  }
  return state.codes
}

/** /health is public: cache its COUNT(*)s so it can't be used to load the lab's DB. */
export function getHealth() {
  if (!state.health || Date.now() - state.health.at > 60_000) {
    const value = getDb().then(diagnostics)
    value.catch(() => { state.health = undefined })
    state.health = { at: Date.now(), value }
  }
  return state.health.value
}
