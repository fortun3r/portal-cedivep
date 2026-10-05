/**
 * The queries. Everything the portal reads from the database goes through here.
 *
 * The portal is READ-ONLY: it doesn't write a single row in the lab's database.
 * Login codes and sessions live in server memory and signed cookies (auth.ts),
 * so a SELECT-only user is enough.
 *
 * The result → clinic link, verified at 99.97 % against the real database:
 *   descres (FEC_PED, NROMOV) = pedidos (FECHA_RECE, NRO_RECEPC) → CLINICA
 */
import 'server-only'
import { config } from './config'
import { emailsIn, phonesIn } from './contact'
import type { Db } from './db'
import { buildReport, summarizeOrders, validDate } from './report'
import type { Clinic, ClinicaRow, DescresRow, OrderSummary, PedidoRow, Report } from './types'

/** Orders the lab cancelled or deleted are never shown. */
const CURRENT = `COALESCE(p.ANULADO, '') <> 'S' AND COALESCE(p.BORRADO, '') <> 'S'`

/**
 * `descres` has no clinic column: its rows are found by (date, number) alone.
 * If two clinics ever share that key, nobody gets to see it (fail closed)
 * rather than one clinic seeing the other's results.
 */
const UNAMBIGUOUS = `NOT EXISTS (SELECT 1 FROM pedidos p2
  WHERE p2.FECHA_RECE = p.FECHA_RECE AND p2.NRO_RECEPC = p.NRO_RECEPC AND p2.CLINICA <> p.CLINICA)`

const JOIN = `p.FECHA_RECE = d.FEC_PED AND p.NRO_RECEPC = d.NROMOV`

const ORDER_COLS = `p.FECHA_RECE, p.NRO_RECEPC, p.REFERENCIA, p.CLINICA, p.VETERINARI,
  p.FECHA_EXTR, p.FECHA_ENTR, p.URGENTE`

const DESCRES_COLS = `d.FEC_PED, d.NROMOV, d.CODANAL, d.NROSEC, d.ORDEN, d.UBICACION,
  d.ANIMAL, d.MATERIAL, d.TITULO, d.NOMANAL, d.NOMRESULTA, d.OBSERVA, d.RESULTADO,
  d.RELATIVA, d.MEDIDA, d.REFERENCIA, d.UNIDAD, d.DENTRO,
  d.SEXOC, d.RAZA, d.EDAD, d.ESPECIE, d.PELAJE`

// ───────────────────────────────────────────── results window

export interface ResultsWindow { start: string | null; end: string | null }

let cachedWindow: (ResultsWindow & { readAt: number }) | null = null

/**
 * The MySQL holds a moving window of `descres` (12 days in probe v5).
 * Cached for 10 minutes.
 */
export async function getResultsWindow(db: Db): Promise<ResultsWindow> {
  if (!cachedWindow || Date.now() - cachedWindow.readAt > 10 * 60_000) {
    const [r] = await db.all<{ first_day: string; last_day: string }>(
      `SELECT MIN(FEC_PED) AS first_day, MAX(FEC_PED) AS last_day FROM descres`,
    )
    cachedWindow = { start: validDate(r?.first_day), end: validDate(r?.last_day), readAt: Date.now() }
  }
  return { start: cachedWindow.start, end: cachedWindow.end }
}

// ───────────────────────────────────────────── orders and reports

export async function listOrders(db: Db, clinic: number, limit = 500): Promise<OrderSummary[]> {
  const orders = await db.all<PedidoRow>(
    `SELECT ${ORDER_COLS} FROM pedidos p
      WHERE p.CLINICA = ? AND ${CURRENT} AND ${UNAMBIGUOUS}
      ORDER BY p.FECHA_RECE DESC, p.NRO_RECEPC DESC
      LIMIT ${Math.max(1, Math.min(2000, Math.floor(limit)))}`,
    [clinic],
  )
  if (!orders.length) return []

  const rows = await db.all<DescresRow>(
    `SELECT d.FEC_PED, d.NROMOV, d.ANIMAL, d.NOMANAL, d.NOMRESULTA, d.TITULO,
            d.DENTRO, d.RESULTADO, d.ORDEN, d.CODANAL, d.UBICACION
       FROM descres d JOIN pedidos p ON ${JOIN}
      WHERE p.CLINICA = ? AND ${CURRENT} AND ${UNAMBIGUOUS}`,
    [clinic],
  )
  const { start } = await getResultsWindow(db)
  return summarizeOrders(orders, rows, start)
}

/**
 * A full report. The `CLINICA = ?` condition IS the authorization: a clinic
 * that changes the URL to someone else's order gets null (→ 404), never the
 * report. There's a test for it.
 */
export async function getReport(db: Db, clinic: number, date: string, number: number): Promise<Report | null> {
  if (!validDate(date) || !Number.isInteger(number) || number <= 0) return null

  const [order] = await db.all<PedidoRow>(
    `SELECT ${ORDER_COLS} FROM pedidos p
      WHERE p.FECHA_RECE = ? AND p.NRO_RECEPC = ? AND p.CLINICA = ? AND ${CURRENT} AND ${UNAMBIGUOUS}`,
    [date, number, clinic],
  )
  if (!order) return null

  const rows = await db.all<DescresRow>(
    `SELECT ${DESCRES_COLS} FROM descres d WHERE d.FEC_PED = ? AND d.NROMOV = ?`,
    [date, number],
  )
  return buildReport(order, rows)
}

// ───────────────────────────────────────────── clinic directory

export interface LookupResult {
  clinics: Clinic[]
  /** Why login isn't possible, if it isn't. For the log, never for the user. */
  reason?: 'no_match' | 'shared_contact'
}

/**
 * contact → clinics index, built from `clini_vet` (4,312 rows, nothing) and
 * refreshed every 10 minutes. Done in memory because phones are stored in
 * formats impossible to compare in SQL ('0981 163 342', '981-163.342'…).
 */
export class ClinicDirectory {
  private index = new Map<string, Clinic[]>()
  private shared = new Set<string>()
  private loadedAt = 0
  private lastForcedReload = 0

  constructor(private db: Db) {}

  async load() {
    const rows = await this.db.all<ClinicaRow>(
      `SELECT CODIGO, NOMBRE, TELEFONO, CORREO, HABILITA, MOROSO FROM clini_vet`,
    )
    const a = config.auth
    const index = new Map<string, Clinic[]>()
    for (const r of rows) {
      const code = Number(r.CODIGO)
      if (!Number.isInteger(code) || a.wildcardClinics.includes(code)) continue
      if (a.blockDisabled && String(r.HABILITA ?? '').trim().toUpperCase() === 'N') continue
      if (a.blockDelinquent && String(r.MOROSO ?? '').trim().toUpperCase() === 'S') continue
      const clinic = { code, name: String(r.NOMBRE ?? '').trim() || `Clínica ${code}` }
      const keys = [
        ...phonesIn(r.TELEFONO).map((t) => `tel:${t}`),
        ...emailsIn(r.CORREO).map((c) => `mail:${c}`),
      ]
      for (const k of new Set(keys)) {
        if (!index.has(k)) index.set(k, [])
        index.get(k)!.push(clinic)
      }
    }
    this.shared = new Set(
      [...index].filter(([, cs]) => cs.length > a.maxClinicsPerContact).map(([k]) => k),
    )
    for (const k of this.shared) index.delete(k)
    this.index = index
    this.loadedAt = Date.now()
    return { clinics: rows.length, contacts: index.size, shared: this.shared.size }
  }

  async lookup(key: string): Promise<LookupResult> {
    if (Date.now() - this.loadedAt > 10 * 60_000) await this.load()
    const r = this.resolve(key)
    // A clinic registered minutes ago: refresh (at most once a minute) in the
    // background. Not awaited, so response time doesn't reveal unknown contacts.
    if (r.reason === 'no_match' && Date.now() - this.lastForcedReload > 60_000) {
      this.lastForcedReload = Date.now()
      void this.load().catch((e) => console.error('[directory] reload failed', e))
    }
    return r
  }

  private resolve(key: string): LookupResult {
    if (this.shared.has(key)) return { clinics: [], reason: 'shared_contact' }
    const cs = this.index.get(key)
    return cs?.length ? { clinics: cs } : { clinics: [], reason: 'no_match' }
  }
}

// ───────────────────────────────────────────── diagnostics

export async function diagnostics(db: Db) {
  const count = async (t: string) => {
    try { return Number((await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))[0].n) }
    catch { return null }
  }
  return {
    counts: { descres: await count('descres'), pedidos: await count('pedidos'), clini_vet: await count('clini_vet') },
    window: await getResultsWindow(db),
  }
}
