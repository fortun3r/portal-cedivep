/**
 * Builds the report from the `descres` rows. Pure functions, no database, so
 * they can be tested.
 *
 * What was learned from the real data (docs/01-hallazgos-descres.md):
 *  - `UBICACION` is the print order. NOT `ORDEN` or `NROSEC`: with NROSEC the
 *    analyses of one animal get interleaved.
 *  - `ORDEN` identifies the ANIMAL. An order can be a whole herd (there is a
 *    real one with 650 rows and 24 pages).
 *  - `CODANAL` groups one full analysis: the hemogram (2423) has two sections,
 *    BIOMETRIA HEMATICA and LEUCOGRAMA.
 *  - `TITULO`='S' is a section title; `DENTRO`='N' is out of range.
 */
import { config } from './config'
import type {
  Analysis, AnimalReport, DescresRow, Line, OrderStatus, OrderSummary, PedidoRow, Report,
} from './types'

const { isTitle, isOutOfRange, empty } = config.sentinels

/** Clean text, or '' if it's a filler value of the legacy system. */
export function clean(v: unknown): string {
  const s = String(v ?? '').replace(/\r/g, '').trim()
  return empty.has(s.toUpperCase()) ? '' : s
}

const n = (v: unknown) => Number(v ?? 0) || 0

/**
 * Numbers as on the printed report: the DB stores '7826000' and '11.6', the
 * paper says '7.826.000' and '11,6'. Only purely numeric values are touched;
 * '79% - POSITIVO', '1/400' or '0,186' stay as they are. Leading zeros
 * ('00', '03') too, because that's how they're printed.
 */
export function formatNumber(v: string): string {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(v.trim())
  if (!m) return v
  const [, sign, integer, decimals] = m
  if (integer.length > 1 && integer.startsWith('0')) return v
  const thousands = integer.length >= 4 ? integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : integer
  return sign + thousands + (decimals !== undefined ? `,${decimals}` : '')
}

function line(r: DescresRow): Line {
  if (isTitle(r.TITULO)) {
    return {
      kind: 'section', name: clean(r.NOMRESULTA) || clean(r.NOMANAL),
      value: '', unit: '', relative: '', range: '', outOfRange: false,
    }
  }
  const value = String(r.RESULTADO ?? '').trim()
  const relative = clean(r.RELATIVA)
  return {
    kind: 'measurement',
    name: clean(r.NOMRESULTA) || clean(r.NOMANAL),
    value: formatNumber(value),
    unit: clean(r.UNIDAD),
    relative: relative ? [formatNumber(relative), clean(r.MEDIDA)].filter(Boolean).join(' ') : '',
    range: clean(r.REFERENCIA),
    // An "out of range" without a value is not a finding: it's data not yet loaded.
    outOfRange: isOutOfRange(r.DENTRO) && value !== '',
  }
}

/** Groups an animal's rows into analyses, keeping the print order. */
function analysesOf(rows: DescresRow[]): Analysis[] {
  const blocks = new Map<string, DescresRow[]>()
  for (const r of rows) {
    const k = String(n(r.CODANAL))
    if (!blocks.has(k)) blocks.set(k, [])
    blocks.get(k)!.push(r)
  }
  return [...blocks.values()].map((b) => ({
    name: clean(b.find((r) => isTitle(r.TITULO))?.NOMRESULTA) || clean(b[0].NOMRESULTA),
    material: clean(b[0].MATERIAL),
    method: [...new Set(b.map((r) => clean(r.OBSERVA)).filter(Boolean))].join('\n'),
    lines: b.map(line),
  }))
}

export function buildReport(order: PedidoRow, unsortedRows: DescresRow[]): Report {
  const rows = [...unsortedRows].sort((a, b) => n(a.UBICACION) - n(b.UBICACION))

  const byAnimal = new Map<number, DescresRow[]>()
  for (const r of rows) {
    const o = n(r.ORDEN)
    if (!byAnimal.has(o)) byAnimal.set(o, [])
    byAnimal.get(o)!.push(r)
  }

  const animals: AnimalReport[] = [...byAnimal.entries()]
    .sort(([a], [b]) => a - b)
    .map(([order, rs]) => {
      const p = rs[0]
      const analyses = analysesOf(rs)
      return {
        order,
        id: clean(p.ANIMAL) || `Animal ${order}`,
        sex: clean(p.SEXOC),
        breed: clean(p.RAZA),
        age: clean(p.EDAD),
        species: clean(p.ESPECIE),
        coat: clean(p.PELAJE),
        analyses,
        outOfRange: analyses.flatMap((a) => a.lines).filter((l) => l.outOfRange).length,
      }
    })

  return {
    receivedOn: String(order.FECHA_RECE).slice(0, 10),
    number: n(order.NRO_RECEPC),
    label: orderLabel(order),
    deliveryDate: validDate(order.FECHA_ENTR),
    animals,
    outOfRange: animals.reduce((s, a) => s + a.outOfRange, 0),
  }
}

/** The printed label ('260728/160'); rebuilt if missing. */
export function orderLabel(p: Pick<PedidoRow, 'REFERENCIA' | 'FECHA_RECE' | 'NRO_RECEPC'>): string {
  const ref = clean(p.REFERENCIA)
  if (ref) return ref
  const [y, m, d] = String(p.FECHA_RECE).slice(0, 10).split('-')
  return `${y.slice(2)}${m}${d}/${String(n(p.NRO_RECEPC)).padStart(3, ' ')}`
}

/** A valid 'YYYY-MM-DD' date, or null (the legacy system stores '0000-00-00'). */
export function validDate(v: unknown): string | null {
  const s = String(v ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !s.startsWith('0000') ? s : null
}

/**
 * Order list with each order's status.
 *
 * `windowStart` is the oldest date in `descres`. The MySQL only has a moving
 * window of results; an older order without results is NOT "in progress", it
 * simply fell outside what was synced.
 */
export function summarizeOrders(
  orders: PedidoRow[],
  unsortedRows: Pick<DescresRow, 'FEC_PED' | 'NROMOV' | 'ANIMAL' | 'NOMANAL' | 'NOMRESULTA' | 'TITULO' | 'DENTRO' | 'RESULTADO' | 'ORDEN' | 'CODANAL' | 'UBICACION'>[],
  windowStart: string | null,
): OrderSummary[] {
  const key = (f: unknown, m: unknown) => `${String(f).slice(0, 10)}|${n(m)}`
  const rows = [...unsortedRows].sort((a, b) => n(a.UBICACION) - n(b.UBICACION))
  const byOrder = new Map<string, typeof rows>()
  for (const r of rows) {
    const k = key(r.FEC_PED, r.NROMOV)
    if (!byOrder.has(k)) byOrder.set(k, [])
    byOrder.get(k)!.push(r)
  }

  return orders.map((p) => {
    const date = String(p.FECHA_RECE).slice(0, 10)
    const rs = byOrder.get(key(date, p.NRO_RECEPC)) ?? []
    let status: OrderStatus = 'available'
    if (!rs.length) status = windowStart && date >= windowStart ? 'in_progress' : 'outside_window'

    const animals = [...new Map(rs.map((r) => [n(r.ORDEN), clean(r.ANIMAL)])).values()].filter(Boolean)
    // Name of each analysis: its section title if it has one (LEPTOSPIROSIS),
    // otherwise its only test (INFORME DE BRUCELOSIS). Two passes, because rows
    // can arrive in any order.
    const analyses = new Map<number, string>()
    for (const r of rs) {
      if (isTitle(r.TITULO) && !analyses.has(n(r.CODANAL))) analyses.set(n(r.CODANAL), clean(r.NOMRESULTA))
    }
    for (const r of rs) {
      if (!analyses.has(n(r.CODANAL))) analyses.set(n(r.CODANAL), clean(r.NOMRESULTA) || clean(r.NOMANAL))
    }
    return {
      receivedOn: date,
      number: n(p.NRO_RECEPC),
      label: orderLabel(p),
      status,
      deliveryDate: validDate(p.FECHA_ENTR),
      urgent: String(p.URGENTE ?? '').trim().toUpperCase() === 'S',
      animals,
      analyses: [...new Set(analyses.values())].filter(Boolean),
      outOfRange: rs.filter((r) => !isTitle(r.TITULO) && isOutOfRange(r.DENTRO)
        && String(r.RESULTADO ?? '').trim() !== '').length,
    }
  })
}

// ───────────────────────────────────────────── herds

export interface MatrixColumn { section: string; name: string; range: string }
export interface Matrix {
  columns: MatrixColumn[]
  rows: { order: number; animal: string; cells: { value: string; outOfRange: boolean }[]; outOfRange: number }[]
}

/** From how many animals an order is shown as a herd. */
export const HERD_MIN_ANIMALS = 4

/** "11,6 g/dL": a measurement's value with its unit. */
const valueWithUnit = (l: Line) => [l.value, l.unit].filter(Boolean).join(' ')

/**
 * For herds: one row per animal, one column per test. That's how a vet reads
 * 50 cows, not as 50 reports one under the other.
 *
 * Only applies if every animal has exactly the same tests in the same order;
 * otherwise (a mixed herd) returns null and the report goes animal by animal.
 */
export function herdMatrix(report: Report): Matrix | null {
  if (report.animals.length < HERD_MIN_ANIMALS) return null

  const signature = (a: AnimalReport) => {
    const cols: MatrixColumn[] = []
    for (const an of a.analyses) {
      let section = ''
      for (const l of an.lines) {
        if (l.kind === 'section') section = l.name
        else cols.push({ section, name: l.name, range: l.range })
      }
    }
    return cols
  }
  const columns = signature(report.animals[0])
  const key = (cs: MatrixColumn[]) => cs.map((c) => `${c.section}|${c.name}`).join('\n')
  const k0 = key(columns)
  if (!columns.length || report.animals.some((a) => key(signature(a)) !== k0)) return null

  // The range goes in the header only if it's the same for every animal.
  const ranges = columns.map((_, i) => new Set(report.animals.map((a) => signature(a)[i].range)))
  columns.forEach((c, i) => { c.range = ranges[i].size === 1 ? c.range : '' })

  return {
    columns,
    rows: report.animals.map((a) => {
      const cells = a.analyses.flatMap((an) => an.lines.filter((l) => l.kind === 'measurement'))
        .map((l) => ({ value: valueWithUnit(l), outOfRange: l.outOfRange }))
      return { order: a.order, animal: a.id, cells, outOfRange: a.outOfRange }
    }),
  }
}

// ───────────────────────────────────────────── summary, profile, sharing

export interface Finding { animal: string; name: string; value: string; range: string }

/**
 * The values the lab flagged out of range (`DENTRO='N'`), in print order. It
 * does NOT interpret: a "79% - POSITIVO" inside range stays out. For herds the
 * name carries the section ("LEPTOSPIROSIS · Hardjo").
 */
export function findings(report: Report): Finding[] {
  const several = report.animals.length > 1
  const out: Finding[] = []
  for (const a of report.animals) {
    for (const an of a.analyses) {
      let section = ''
      for (const l of an.lines) {
        if (l.kind === 'section') section = l.name
        else if (l.outOfRange) {
          out.push({
            animal: a.id,
            name: several && section ? `${section} · ${l.name}` : l.name,
            value: valueWithUnit(l),
            range: l.range,
          })
        }
      }
    }
  }
  return out
}

/** "1 valor fuera de rango" · "8 valores fuera de rango en 7 animales". */
export function findingsTitle(report: Report): string {
  const total = report.outOfRange
  const animals = report.animals.filter((a) => a.outOfRange > 0).length
  return `${total} ${total === 1 ? 'valor' : 'valores'} fuera de rango${animals > 1 ? ` en ${animals} animales` : ''}`
}

const PROFILE_FIELDS = [
  ['Especie', 'species'], ['Raza', 'breed'], ['Sexo', 'sex'], ['Edad', 'age'], ['Pelaje', 'coat'],
] as const

/** An animal's profile as [label, value] pairs, empty ones left out. */
export function profile(a: AnimalReport): [string, string][] {
  return PROFILE_FIELDS.map(([label, k]): [string, string] => [label, a[k]]).filter(([, v]) => v)
}

/** What every animal of a herd shares (Raza NELORE · Sexo Hembra · Edad 2.00 Años). */
export function commonProfile(report: Report): [string, string][] {
  const [first, ...rest] = report.animals
  if (!first) return []
  return profile(first).filter(([label]) => {
    const k = PROFILE_FIELDS.find(([l]) => l === label)![1]
    return rest.every((a) => a[k] === first[k])
  })
}

/**
 * WhatsApp message for sharing a report. No values or findings: the chat
 * stays on third parties' phones. The link still requires logging in.
 */
export function whatsAppText(report: Report, url: string): string {
  const who = report.animals.length === 1 ? report.animals[0].id : `${report.animals.length} animales`
  const names = [...new Set(report.animals.flatMap((a) => a.analyses.map((an) => an.name)))].filter(Boolean)
  return `Resultados CEDIVEP · Ref. ${report.label.replace(/\s/g, '')} · ${who} (${names.join(', ')})\n${url}`
}
