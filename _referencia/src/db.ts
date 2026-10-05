/**
 * Dos drivers detrás de una interfaz mínima.
 *
 *   sqlite → demo autocontenido, con datos de ejemplo. No necesita servidor.
 *   mysql  → la base real del laboratorio.
 *
 * El SQL de repo.ts es deliberadamente simple para que corra igual en los dos.
 * Placeholders `?` en ambos.
 */
import { DatabaseSync } from 'node:sqlite'
import { config } from './config.js'
import { SCHEMA_SQLITE, SEED } from './seed/fixture.js'

export interface Db {
  all<T = any>(sql: string, params?: unknown[]): Promise<T[]>
  close(): Promise<void>
  label: string
}

export function makeSqlite(): Db {
  const db = new DatabaseSync(':memory:')
  db.exec(SCHEMA_SQLITE)
  for (const { tabla, filas } of SEED) {
    if (!filas.length) continue
    const cols = Object.keys(filas[0])
    const stmt = db.prepare(
      `INSERT INTO ${tabla} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    )
    for (const f of filas) stmt.run(...cols.map((c) => (f as any)[c] ?? null))
  }
  return {
    label: 'sqlite (demo con datos de ejemplo)',
    async all<T>(sql: string, params: unknown[] = []) {
      return db.prepare(sql).all(...(params as any[])) as T[]
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
    throw new Error('CEDIVEP_DRIVER=mysql pero faltan DB_HOST / DB_USER. Revisá el .env')
  }
  const pool = mysql.createPool({
    host, port, user, password, database, connectTimeout,
    waitForConnections: true,
    connectionLimit: 5,
    charset: 'utf8mb4',     // verificado: la base es utf8mb4 y los acentos llegan bien
    // Las fechas como texto 'YYYY-MM-DD'. Si no, mysql2 las convierte a Date en
    // la zona horaria del servidor y en Paraguay (UTC-3) se corren un día.
    dateStrings: true,
  })
  return {
    label: `mysql ${host}:${port}/${database}`,
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
  return config.driver === 'mysql' ? makeMysql() : makeSqlite()
}
