/**
 * Two drivers behind a minimal interface.
 *
 *   sqlite → self-contained demo with sample data. Needs no server.
 *   mysql  → the lab's real database.
 *
 * The SQL in repo.ts is deliberately simple so it runs the same on both.
 * `?` placeholders on both.
 */
import 'server-only'
import type { SQLInputValue } from 'node:sqlite'
import { config } from './config'
import { SCHEMA_SQLITE, SEED } from './seed/fixture'

export interface Db {
  all<T>(sql: string, params?: unknown[]): Promise<T[]>
  close(): Promise<void>
  /** Shown on /health: never the host. */
  label: 'sqlite' | 'mysql'
}

export function makeSqlite(): Db {
  // Turbopack doesn't externalize `node:sqlite`; this bypasses the bundler.
  const { DatabaseSync } = process.getBuiltinModule('node:sqlite')
  const db = new DatabaseSync(':memory:')
  db.exec(SCHEMA_SQLITE)
  for (const { table, rows } of SEED) {
    if (!rows.length) continue
    const cols = Object.keys(rows[0])
    const stmt = db.prepare(
      `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    )
    for (const r of rows) stmt.run(...cols.map((c) => (r[c] ?? null) as SQLInputValue))
  }
  return {
    label: 'sqlite',
    async all<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...(params as SQLInputValue[])) as T[]
    },
    async close() {
      db.close()
    },
  }
}

async function makeMysql(): Promise<Db> {
  const mysql = await import('mysql2/promise')
  const { host, port, user, password, database, connectTimeout } = config.mysql
  if (!host || !user) {
    throw new Error('CEDIVEP_DRIVER=mysql but DB_HOST / DB_USER are missing. Check .env.local')
  }
  const pool = mysql.createPool({
    host, port, user, password, database, connectTimeout,
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4',     // verified: the DB is utf8mb4 and accents arrive fine
    // Dates as 'YYYY-MM-DD' text. Otherwise mysql2 turns them into Date in the
    // server's timezone and in Paraguay (UTC-3) they shift by one day.
    dateStrings: true,
  })
  return {
    label: 'mysql',
    async all<T>(sql: string, params: unknown[] = []) {
      const [rows] = await pool.query(sql, params)
      return rows as T[]
    },
    async close() {
      await pool.end()
    },
  }
}

export async function openDb(): Promise<Db> {
  return config.isFixtureDb ? makeSqlite() : makeMysql()
}
