/**
 * The order list: search, status filter, date grouping and "new since your
 * last visit". Pure functions, tested in test/orders.test.ts.
 */
import type { OrderStatus, OrderSummary } from './types'

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre']

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** '2026-07-24' → '24/07/2026'. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

/**
 * '2026-07-24' → 'Viernes 24 de julio'. Built from the string with Date.UTC:
 * `new Date(iso)` would shift the day in UTC-3.
 */
export function longDate(iso: string): string {
  const m = ISO_DATE.exec(iso)
  if (!m) return iso
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  return `${DAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()]} ${d} de ${MONTHS[mo - 1]}`
}

/**
 * Today's date in Paraguay.
 * ponytail: fixed UTC-3 (permanent since Oct 2024); Node 22.13's tzdata still applies the old DST to America/Asuncion.
 */
export function todayPy(now = Date.now()): string {
  return new Date(now - 3 * 3_600_000).toISOString().slice(0, 10)
}

/** "Resultados en línea del 22/07 al 24/07/2026" (the year is repeated only if it changes). */
export function windowText(start: string, end: string): string {
  const from = start.slice(0, 4) === end.slice(0, 4) ? formatDate(start).slice(0, 5) : formatDate(start)
  return `Resultados en línea del ${from} al ${formatDate(end)}`
}

export interface DateGroup { date: string; title: string; orders: OrderSummary[] }

/** Groups by reception date, newest first, keeping the order within each day. */
export function groupByDate(orders: OrderSummary[]): DateGroup[] {
  const groups = new Map<string, OrderSummary[]>()
  for (const o of orders) {
    if (!groups.has(o.receivedOn)) groups.set(o.receivedOn, [])
    groups.get(o.receivedOn)!.push(o)
  }
  return [...groups]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, os]) => ({ date, title: longDate(date), orders: os }))
}

/** Lowercase, without accents, for searching. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Every term must appear in the label, the date, an animal (any tag of the herd) or an analysis. */
export function matchesQuery(o: OrderSummary, q: string): boolean {
  const text = fold([o.label, o.label.replace(/\s/g, ''), o.receivedOn, formatDate(o.receivedOn),
    ...o.animals, ...o.analyses].join(' '))
  return fold(q).split(/\s+/).filter(Boolean).every((t) => text.includes(t))
}

/** `?estado=` values (Spanish: they are in the address bar) → statuses. */
export const STATUS_PARAM = {
  disponible: 'available',
  en_proceso: 'in_progress',
  fuera_de_ventana: 'outside_window',
} as const satisfies Record<string, OrderStatus>

export type StatusParam = keyof typeof STATUS_PARAM

/** A known `?estado=` value, or null (= all). Own keys only: `__proto__` is unknown. */
export function statusParam(v: unknown): StatusParam | null {
  return typeof v === 'string' && Object.hasOwn(STATUS_PARAM, v) ? (v as StatusParam) : null
}

export type StatusCounts = Record<OrderStatus | 'all', number>

/** Search, then filter by status. Counts are taken after the search, before the filter. */
export function filterOrders(all: OrderSummary[], q: string, status: OrderStatus | null) {
  const searched = q ? all.filter((o) => matchesQuery(o, q)) : all
  const counts: StatusCounts = { all: searched.length, available: 0, in_progress: 0, outside_window: 0 }
  for (const o of searched) counts[o.status]++
  return { orders: status ? searched.filter((o) => o.status === status) : searched, counts }
}

// ───────────────────────────────────────────── "new since your last visit"

/**
 * Per clinic: [previous visit day, last visit day]. Keeping both makes the
 * badge stable for the whole day (filter and search clicks are new GETs of
 * /pedidos) and makes recordVisit idempotent.
 */
export type Visits = Record<string, [previous: string, last: string]>

const MAX_CLINICS_IN_VISITS = 10

export function recordVisit(visits: Visits, clinic: number, today: string): { visits: Visits; previous: string | null } {
  const key = String(clinic)
  const [previous, last] = visits[key] ?? ['', '']
  const entry: [string, string] = last === today ? [previous, last] : [last, today]
  const next: Visits = { ...visits, [key]: entry }
  // Drop the clinics visited longest ago. Not by key order: integer-like keys always enumerate ascending.
  const others = Object.keys(next).filter((k) => k !== key).sort((x, y) => next[x][1].localeCompare(next[y][1]))
  for (const k of others.slice(0, Math.max(0, others.length + 1 - MAX_CLINICS_IN_VISITS))) delete next[k]
  return { visits: next, previous: entry[0] || null }
}

/** Validates a signed visit cookie's payload. Anything unexpected → no visits. */
export function asVisits(data: Record<string, unknown> | null): Visits {
  const v = data?.visits
  if (typeof v !== 'object' || v === null) return {}
  const out: Visits = {}
  for (const [k, pair] of Object.entries(v)) {
    if (/^\d+$/.test(k) && Array.isArray(pair) && pair.length === 2
      && pair.every((d) => d === '' || (typeof d === 'string' && ISO_DATE.test(d)))) {
      out[k] = [pair[0], pair[1]]
    }
  }
  return out
}

/** "New" = results available, received after the previous visit day. Approximation: descres has no load date. */
export const isNew = (o: OrderSummary, previousVisit: string | null) =>
  o.status === 'available' && !!previousVisit && o.receivedOn > previousVisit

export const countNew = (orders: OrderSummary[], previousVisit: string | null) =>
  orders.filter((o) => isNew(o, previousVisit)).length
