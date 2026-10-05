import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReport, formatNumber, herdMatrix, orderLabel, summarizeOrders, validDate } from '../src/lib/report'
import type { DescresRow, PedidoRow } from '../src/lib/types'

const order: PedidoRow = {
  FECHA_RECE: '2026-07-28', NRO_RECEPC: '160', REFERENCIA: '260728/160', CLINICA: '2646',
  VETERINARI: '1', FECHA_EXTR: '2026-07-28', FECHA_ENTR: '0000-00-00', URGENTE: 'N',
}

const row = (o: Partial<DescresRow>): DescresRow => ({
  FEC_PED: '2026-07-28', NROMOV: '160', CODANAL: '2423', NROSEC: '1', ORDEN: '1', UBICACION: '5',
  ANIMAL: 'LOLA', MATERIAL: 'SANGRE', TITULO: 'N', NOMANAL: '', NOMRESULTA: '',
  OBSERVA: '', RESULTADO: '', RELATIVA: '', MEDIDA: '', REFERENCIA: '', UNIDAD: '', DENTRO: 'S',
  SEXOC: 'Hembra', RAZA: 'C.M', EDAD: '3.00 Años', ESPECIE: '', PELAJE: 'SIN PELAJE', ...o,
})

test("TITULO='N' is a measurement, not a title (the MVP bug)", () => {
  const r = buildReport(order, [
    row({ UBICACION: 5, TITULO: 'S', NOMRESULTA: 'BIOMETRIA HEMATICA' }),
    row({ UBICACION: 10, TITULO: 'N', NOMRESULTA: 'Hemoglobina', RESULTADO: '17.3' }),
  ])
  assert.deepEqual(r.animals[0].analyses[0].lines.map((l) => l.kind), ['section', 'measurement'])
})

test('sorts by UBICACION even when rows arrive unsorted', () => {
  const r = buildReport(order, [
    row({ UBICACION: 45, TITULO: 'S', NOMRESULTA: 'LEUCOGRAMA' }),
    row({ UBICACION: 10, NOMRESULTA: 'Hemoglobina', RESULTADO: '17.3' }),
    row({ UBICACION: 5, TITULO: 'S', NOMRESULTA: 'BIOMETRIA HEMATICA' }),
    row({ UBICACION: 50, NOMRESULTA: 'Glóbulos Blancos', RESULTADO: '12000' }),
  ])
  assert.deepEqual(r.animals[0].analyses[0].lines.map((l) => l.name),
    ['BIOMETRIA HEMATICA', 'Hemoglobina', 'LEUCOGRAMA', 'Glóbulos Blancos'])
})

test("DENTRO='N' flags out of range, but not on titles or empty values", () => {
  const r = buildReport(order, [
    row({ UBICACION: 5, TITULO: 'S', NOMRESULTA: 'LEUCOGRAMA', DENTRO: 'N' }),
    row({ UBICACION: 10, NOMRESULTA: 'Neutrofilos en banda', RESULTADO: '03', DENTRO: 'N' }),
    row({ UBICACION: 15, NOMRESULTA: 'Monocitos', RESULTADO: '', DENTRO: 'N' }),
    row({ UBICACION: 20, NOMRESULTA: 'Linfocitos', RESULTADO: '18', DENTRO: 'S' }),
  ])
  assert.deepEqual(r.animals[0].analyses[0].lines.map((l) => l.outOfRange), [false, true, false, false])
  assert.equal(r.outOfRange, 1)
})

test('ORDEN separates animals: a herd with results interleaved by analysis', () => {
  // The lab's real order: brucellosis 804/806/808, IBR 904/906/908…
  const rows = ['154983', '151667', '126'].flatMap((tag, i) => [
    row({ ORDEN: i + 1, ANIMAL: tag, CODANAL: 49, UBICACION: 804 + i * 2, NOMRESULTA: 'INFORME DE BRUCELOSIS', RESULTADO: 'Negativo' }),
    row({ ORDEN: i + 1, ANIMAL: tag, CODANAL: 53, UBICACION: 904 + i * 2, NOMRESULTA: 'IBR (ELISA)', RESULTADO: '80% - POSITIVO' }),
  ])
  const r = buildReport(order, rows.reverse())
  assert.deepEqual(r.animals.map((a) => a.id), ['154983', '151667', '126'])
  for (const a of r.animals) {
    assert.deepEqual(a.analyses.map((x) => x.name), ['INFORME DE BRUCELOSIS', 'IBR (ELISA)'])
  }
})

test("the legacy system's filler values are not shown", () => {
  const r = buildReport(order, [row({ NOMRESULTA: 'Hemoglobina', RESULTADO: '17.3', RELATIVA: '0' })])
  const a = r.animals[0]
  assert.equal(a.coat, '')                               // 'SIN PELAJE'
  assert.equal(a.analyses[0].lines[0].relative, '')      // '0'
  assert.equal(r.deliveryDate, null)                     // '0000-00-00'
})

test('the relative value carries its unit', () => {
  const r = buildReport(order, [row({ NOMRESULTA: 'Neutrofilos', RESULTADO: '76', UNIDAD: '%', RELATIVA: '9120', MEDIDA: '/mm3' })])
  assert.equal(r.animals[0].analyses[0].lines[0].relative, '9.120 /mm3')
})

test('label and dates', () => {
  assert.equal(orderLabel({ REFERENCIA: '', FECHA_RECE: '2026-07-24', NRO_RECEPC: 5 }), '260724/  5')
  assert.equal(validDate('0000-00-00'), null)
  assert.equal(validDate('2026-07-31'), '2026-07-31')
})

test('order status: available, in progress, or outside the online window', () => {
  const p = (f: string, nro: number) => ({ ...order, FECHA_RECE: f, NRO_RECEPC: nro, REFERENCIA: '' })
  const r = summarizeOrders(
    [p('2026-07-28', 160), p('2026-07-29', 1), p('2026-07-01', 2)],
    [row({ FEC_PED: '2026-07-28', NROMOV: 160, NOMRESULTA: 'Hemoglobina', RESULTADO: '1', DENTRO: 'N' })],
    '2026-07-15',
  )
  assert.deepEqual(r.map((x) => x.status), ['available', 'in_progress', 'outside_window'])
  assert.equal(r[0].outOfRange, 1)
})

test('in the list, an analysis with two titles is named after the first one printed', () => {
  const p = { ...order, REFERENCIA: '' }
  const r = summarizeOrders([p], [
    row({ UBICACION: 45, TITULO: 'S', NOMRESULTA: 'LEUCOGRAMA' }),
    row({ UBICACION: 10, NOMRESULTA: 'Hemoglobina', RESULTADO: '17' }),
    row({ UBICACION: 5, TITULO: 'S', NOMRESULTA: 'BIOMETRIA HEMATICA' }),
  ], '2026-07-01')
  assert.deepEqual(r[0].analyses, ['BIOMETRIA HEMATICA'])
})

test('numbers as on the printed report', () => {
  assert.equal(formatNumber('7826000'), '7.826.000')
  assert.equal(formatNumber('11.6'), '11,6')
  assert.equal(formatNumber('12.0'), '12,0')
  assert.equal(formatNumber('7500'), '7.500')
  assert.equal(formatNumber('41'), '41')
  assert.equal(formatNumber('00'), '00')                       // printed like that
  assert.equal(formatNumber('03'), '03')
  assert.equal(formatNumber('79% - POSITIVO'), '79% - POSITIVO') // text: untouched
  assert.equal(formatNumber('0,186 - POSITIVO'), '0,186 - POSITIVO')
  assert.equal(formatNumber('1/400'), '1/400')
})

test('herd: matrix with one row per animal and one column per test', () => {
  const rows = ['154983', '151667', '126', '105'].flatMap((tag, i) => [
    row({ ORDEN: i + 1, ANIMAL: tag, CODANAL: 55, UBICACION: 4 + i * 16, TITULO: 'S', NOMRESULTA: 'LEPTOSPIROSIS' }),
    row({ ORDEN: i + 1, ANIMAL: tag, CODANAL: 55, UBICACION: 6 + i * 16, NOMRESULTA: 'Hardjo',
          RESULTADO: i === 1 ? '1/400' : 'Negativo', REFERENCIA: 'Negativo', DENTRO: i === 1 ? 'N' : 'S' }),
    row({ ORDEN: i + 1, ANIMAL: tag, CODANAL: 49, UBICACION: 804 + i * 2, NOMRESULTA: 'INFORME DE BRUCELOSIS', RESULTADO: 'Negativo' }),
  ])
  const m = herdMatrix(buildReport(order, rows))!
  assert.ok(m)
  assert.deepEqual(m.columns.map((c) => `${c.section}|${c.name}|${c.range}`),
    ['LEPTOSPIROSIS|Hardjo|Negativo', '|INFORME DE BRUCELOSIS|'])
  assert.deepEqual(m.rows.map((f) => f.animal), ['154983', '151667', '126', '105'])
  assert.deepEqual(m.rows[1].cells, [{ value: '1/400', outOfRange: true }, { value: 'Negativo', outOfRange: false }])
})

test('herd: with fewer than 4 animals, or different tests, there is no matrix', () => {
  const three = [1, 2, 3].map((o) => row({ ORDEN: o, ANIMAL: `A${o}`, NOMRESULTA: 'X', RESULTADO: '1' }))
  assert.equal(herdMatrix(buildReport(order, three)), null)
  const mixed = [1, 2, 3, 4].map((o) => row({ ORDEN: o, ANIMAL: `A${o}`, NOMRESULTA: o === 4 ? 'Y' : 'X', RESULTADO: '1' }))
  assert.equal(herdMatrix(buildReport(order, mixed)), null)
})

// ───────────────────────────────────────────── on the demo fixture

import { SEED } from '../src/lib/seed/fixture'
import { commonProfile, findings, findingsTitle, whatsAppText } from '../src/lib/report'

const table = (t: string) => SEED.find((s) => s.table === t)!.rows
const fixtureReport = (date: string, nro: number) => buildReport(
  table('pedidos').find((p) => p.FECHA_RECE === date && p.NRO_RECEPC === nro) as unknown as PedidoRow,
  table('descres').filter((d) => d.FEC_PED === date && d.NROMOV === nro) as unknown as DescresRow[],
)

test('findings: one animal lists the test alone', () => {
  const r = fixtureReport('2026-07-24', 5)
  assert.deepEqual(findings(r), [{ animal: 'SHAKIRA', name: 'R.D.W.', value: '22,5 %', range: '17,0 - 20,0 %' }])
  assert.equal(findingsTitle(r), '1 valor fuera de rango')
})

test('findings: a herd names section · test, and only what the lab flagged (DENTRO=N)', () => {
  const r = fixtureReport('2026-07-22', 219)
  // IBR "79% - POSITIVO" comes inside range: it is not a finding.
  assert.deepEqual(findings(r), [{ animal: '151667', name: 'LEPTOSPIROSIS · Hardjo', value: '1/400', range: 'Negativo' }])
  assert.equal(findingsTitle(r), '1 valor fuera de rango')
  assert.deepEqual(findings(fixtureReport('2026-07-23', 12)), [])
})

test('findings: the 50-cow herd has 8 values out of range in 7 animals', () => {
  const r = fixtureReport('2026-07-22', 220)
  assert.equal(r.animals.length, 50)
  assert.equal(findings(r).length, 8)
  assert.equal(findingsTitle(r), '8 valores fuera de rango en 7 animales')
  assert.deepEqual([...new Set(findings(r).map((f) => f.animal))],
    ['151667', '296', '156921', '154031', '151755', '154313', '201'])
})

test('common profile: only what every animal shares, never filler values', () => {
  assert.deepEqual(commonProfile(fixtureReport('2026-07-22', 219)),
    [['Raza', 'NELORE'], ['Sexo', 'Hembra'], ['Edad', '2.00 Años']])
  const r = fixtureReport('2026-07-22', 219)
  r.animals[2] = { ...r.animals[2], age: '3.00 Años' }
  assert.deepEqual(commonProfile(r).map(([k]) => k), ['Raza', 'Sexo'])
})

test('the mixed group of 4 has no matrix', () => {
  assert.equal(herdMatrix(fixtureReport('2026-07-23', 13)), null)
  assert.ok(herdMatrix(fixtureReport('2026-07-22', 220)))
})

test('WhatsApp text: reference, animal and analyses, never values', () => {
  const url = 'https://portal.example/pedidos/2026-07-24/5'
  assert.equal(whatsAppText(fixtureReport('2026-07-24', 5), url),
    `Resultados CEDIVEP · Ref. 260724/5 · SHAKIRA (BIOMETRIA HEMATICA)\n${url}`)
  const herd = whatsAppText(fixtureReport('2026-07-22', 219), url)
  assert.match(herd, /^Resultados CEDIVEP · Ref\. 260722\/219 · 4 animales \(LEPTOSPIROSIS, INFORME DE BRUCELOSIS, IBR \(ELISA\), DVB \(ELISA\)\)\n/)
  assert.doesNotMatch(whatsAppText(fixtureReport('2026-07-24', 5), url), /22,5|▲/)
})
