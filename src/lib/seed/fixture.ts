/**
 * Demo data (sqlite driver). Same shape as the real tables and the same
 * verified sentinels ('S'/'N'), so the demo and the real DB behave alike.
 *
 * What it covers, on purpose:
 *  - 260724/5  SHAKIRA: literal transcription of the printed report Olga showed
 *    on 07/26 (R.D.W. 22,5 % outside 17,0-20,0).
 *  - 260722/219  a herd of 4 cows, with the lab's real print order
 *    (UBICACION interleaves animals per analysis: 804, 806, 808…).
 *  - one order in progress, one cancelled, one outside the online window.
 *  - 260722/220  a herd of 50 cows (from the design prototype) to see the matrix with volume.
 *  - 260723/13  a mixed group of 4 animals (clinic 424): no matrix, one section per animal.
 *  - 260723/30  a key shared by two clinics: both must get 404 (repo.ts UNAMBIGUOUS).
 *  - clinic 3100 (0981 000 004): 501 orders, one over repo.ts MAX_LISTED, for paging.
 *  - one phone loaded in two clinics (→ clinic picker).
 *  - the wildcard clinic 1 (private owners), which nobody can log in as.
 *  - rows are inserted UNSORTED: the portal must sort by UBICACION, not trust
 *    the table order.
 */

export const SCHEMA_SQLITE = `
CREATE TABLE clini_vet (
  CODIGO INTEGER, NOMBRE TEXT, TELEFONO TEXT, CORREO TEXT, HABILITA TEXT, MOROSO TEXT
);
CREATE TABLE pedidos (
  FECHA_RECE TEXT, NRO_RECEPC INTEGER, REFERENCIA TEXT, CLINICA INTEGER, VETERINARI INTEGER,
  PROPIETARI INTEGER, FECHA_EXTR TEXT, FECHA_ENTR TEXT, URGENTE TEXT, ANULADO TEXT, BORRADO TEXT
);
CREATE TABLE descres (
  NUMEROID INTEGER, FEC_PED TEXT, NROMOV INTEGER, CODANAL INTEGER, NROSEC INTEGER,
  ORDEN INTEGER, UBICACION INTEGER, ANIMAL TEXT, MATERIAL TEXT, TITULO TEXT,
  NOMANAL TEXT, NOMRESULTA TEXT, OBSERVA TEXT, RESULTADO TEXT, RELATIVA TEXT,
  MEDIDA TEXT, REFERENCIA TEXT, UNIDAD TEXT, DENTRO TEXT,
  SEXOC TEXT, RAZA TEXT, EDAD TEXT, ESPECIE TEXT, PELAJE TEXT
);
`

type Row = Record<string, string | number | null>

// ───────────────────────────────────────────── clinics

const clini_vet: Row[] = [
  { CODIGO: 1, NOMBRE: 'PARTICULAR', TELEFONO: '0981 000 999', CORREO: '', HABILITA: 'S', MOROSO: 'N' },
  { CODIGO: 2646, NOMBRE: 'CLÍNICA TACUARY', TELEFONO: '0981 000 001',
    CORREO: 'tacuary@ejemplo.com.py', HABILITA: 'S', MOROSO: 'N' },
  { CODIGO: 424, NOMBRE: 'VETERINARIA SAN ROQUE', TELEFONO: '0981-000.002 - 0971 000 003',
    CORREO: 'sanroque@ejemplo.com.py,admin@ejemplo.com.py', HABILITA: 'S', MOROSO: 'N' },
  { CODIGO: 77, NOMBRE: 'AGROVET PARAGUARÍ', TELEFONO: '+595 981 000002',
    CORREO: '', HABILITA: 'S', MOROSO: 'S' },
  { CODIGO: 900, NOMBRE: 'CLÍNICA DADA DE BAJA', TELEFONO: '0981 000 009',
    CORREO: '', HABILITA: 'N', MOROSO: 'N' },
  { CODIGO: 3100, NOMBRE: 'VETERINARIA ÑANDUTÍ', TELEFONO: '0981 000 004',
    CORREO: '', HABILITA: 'S', MOROSO: 'N' },
]

// ───────────────────────────────────────────── orders

const P = (date: string, nro: number, clinic: number, extra: Row = {}): Row => {
  const [y, m, d] = date.split('-')
  return {
    FECHA_RECE: date, NRO_RECEPC: nro,
    REFERENCIA: `${y.slice(2)}${m}${d}/${String(nro).padStart(3, ' ')}`,
    CLINICA: clinic, VETERINARI: 41, PROPIETARI: 92680,
    FECHA_EXTR: date, FECHA_ENTR: date, URGENTE: 'N', ANULADO: 'N', BORRADO: 'N',
    ...extra,
  }
}

const pedidos: Row[] = [
  P('2026-07-24', 5, 2646, { FECHA_ENTR: '2026-07-26' }),
  P('2026-07-24', 2, 2646, { FECHA_ENTR: '2026-07-27' }),
  P('2026-07-22', 219, 2646, { FECHA_ENTR: '2026-07-24' }),
  P('2026-07-28', 40, 2646, { FECHA_ENTR: '2026-07-31', URGENTE: 'S' }),   // in progress
  P('2026-07-25', 7, 2646, { ANULADO: 'S' }),                               // cancelled: never shown
  P('2026-07-10', 3, 2646),                                                 // outside the window
  P('2026-07-23', 12, 424, { FECHA_ENTR: '2026-07-25' }),
  P('2026-07-24', 9, 1),                                                    // private owner: nobody sees it
  P('2026-07-22', 220, 2646, { FECHA_ENTR: '2026-07-24' }),                // 50-cow herd
  P('2026-07-23', 13, 424, { FECHA_ENTR: '2026-07-25' }),                  // mixed group of 4
  P('2026-07-23', 30, 2646),                                                // same key in two clinics:
  P('2026-07-23', 30, 424),                                                 // nobody may see it
]

// ───────────────────────────────────────────── results

type Animal = { ANIMAL: string; SEXOC: string; RAZA: string; EDAD: string; ESPECIE: string; PELAJE: string }
type ResultLine = [title: 'S' | 'N', test: string, result: string, unit: string,
                   range: string, inside: 'S' | 'N', relative?: string, measure?: string]

let numeroid = 862000
function rows(date: string, nro: number, order: number, animal: Animal, codanal: number,
              material: string, note: string, firstPosition: number, step: number, lines: ResultLine[]): Row[] {
  const id = ++numeroid
  return lines.map(([title, test, result, unit, range, inside, relative = '', measure = ''], i) => ({
    NUMEROID: id, FEC_PED: date, NROMOV: nro, CODANAL: codanal, NROSEC: i + 1, ORDEN: order,
    UBICACION: firstPosition + i * step, MATERIAL: material, TITULO: title,
    NOMANAL: test, NOMRESULTA: test, OBSERVA: note, RESULTADO: result,
    RELATIVA: relative, MEDIDA: measure, REFERENCIA: range, UNIDAD: unit, DENTRO: inside,
    ...animal,
  }))
}

const SHAKIRA: Animal = { ANIMAL: 'SHAKIRA', SEXOC: 'Hembra', RAZA: 'MESTIZA', EDAD: '4.00 Años',
                          ESPECIE: 'EQUINA', PELAJE: 'ZAINA' }
const ROCKY: Animal = { ANIMAL: 'ROCKY', SEXOC: 'Macho', RAZA: 'LABRADOR', EDAD: '6.00 Años',
                        ESPECIE: 'CANINA', PELAJE: 'SIN PELAJE' }
const LOLA: Animal = { ANIMAL: 'LOLA', SEXOC: 'Hembra', RAZA: 'C.M', EDAD: '3.00 Años',
                       ESPECIE: '', PELAJE: 'SIN PELAJE' }
const cow = (tag: string): Animal => ({ ANIMAL: tag, SEXOC: 'Hembra', RAZA: 'NELORE',
  EDAD: '2.00 Años', ESPECIE: '', PELAJE: 'SIN PELAJE' })

const METHOD_HS = 'Método utilizado: SGC-PROTEC-HS-01'

const hemogram = (rdw: string, rdwInside: 'S' | 'N'): ResultLine[] => [
  ['S', 'BIOMETRIA HEMATICA', '', '', '', 'S'],
  ['N', 'Hemoglobina', '11.6', 'g/dL', '10,0 - 18,0 g/dL', 'S'],
  ['N', 'Hematócrito', '32', '%', '31 - 45 %', 'S'],
  ['N', 'Glóbulos Rojos', '7826000', 'mm3', '(6 - 10) x 10^6 / mm3', 'S'],
  ['N', 'V.C.M.', '41', 'fl', '39 - 50 fl', 'S'],
  ['N', 'H.C.M.', '14.8', 'pg', '14,0 - 19,0 pg', 'S'],
  ['N', 'C.H.C.M.', '36.3', 'g/dL', '31,0 - 37,0 g/dL', 'S'],
  ['N', 'R.D.W.', rdw, '%', '17,0 - 20,0 %', rdwInside],
  ['S', 'LEUCOGRAMA', '', '', '', 'S'],
  ['N', 'Glóbulos Blancos', '7500', 'mm3', '(5.5 - 14) x 10^3 / mm3', 'S'],
  ['N', 'Neutrofilos en banda', '00', '%', '0 - 2 %', 'S', '0', '/mm3'],
  ['N', 'Neutrofilos segmentados', '62', '%', '58 - 78 %', 'S', '4650', '/mm3'],
]

const descres: Row[] = [
  // 260724/5 — SHAKIRA, the report from the video
  ...rows('2026-07-24', 5, 1, SHAKIRA, 2423, 'SANGRE', METHOD_HS, 5, 5, hemogram('22.5', 'N')),

  // 260724/2 — ROCKY, serology
  ...rows('2026-07-24', 2, 1, ROCKY, 57, 'SUERO', 'METODO LABORATORIAL: ELISA', 5, 5, [
    ['S', 'SEROLOGIA', '', '', '', 'S'],
    ['N', 'Neospora caninum', 'NEGATIVO', '', 'Negativo', 'S'],
    ['N', 'Toxoplasma gondii', 'POSITIVO', '', 'Negativo', 'N'],
  ]),

  // 260723/12 — LOLA, from the other clinic
  ...rows('2026-07-23', 12, 1, LOLA, 2423, 'SANGRE', METHOD_HS, 5, 5, hemogram('13.1', 'S')),

  // 260724/9 — a private owner (clinic 1)
  ...rows('2026-07-24', 9, 1, cow('PARTICULAR-1'), 49, 'SANGRE', '', 5, 5, [
    ['N', 'INFORME DE BRUCELOSIS', 'Negativo', '', '', 'S'],
  ]),
]

// 260722/219 — herd of 4 cows. Print order as in the lab: leptospirosis per
// animal (4, 20, 36, 52) and the one-line serologies grouped by analysis with
// the animals interleaved (804, 806, 808, 810).
const herd = ['154983', '151667', '126', '105']
herd.forEach((tag, i) => {
  const order = i + 1
  const a = cow(tag)
  const leptoNote = 'OBSERVACION: SGC-PROTEC-M-04 Microaglutinación'
  descres.push(...rows('2026-07-22', 219, order, a, 55, 'SANGRE', leptoNote, 4 + i * 16, 2, [
    ['S', 'LEPTOSPIROSIS', '', '', '', 'S'],
    ['N', 'Grippotyphosa', 'Negativo', '', 'Negativo', 'S'],
    ['N', 'Hardjo', i === 1 ? '1/400' : 'Negativo', '', 'Negativo', i === 1 ? 'N' : 'S'],
    ['N', 'Pomona', 'Negativo', '', 'Negativo', 'S'],
  ]))
  const ibr = ['79% - POSITIVO', '100% - POSITIVO', '80% - POSITIVO', '12% - Negativo'][i]
  const serologies: [number, string, string, number][] = [
    [49, 'INFORME DE BRUCELOSIS', 'Negativo', 804],
    [53, 'IBR (ELISA)', ibr, 904],
    [51, 'DVB (ELISA)', i === 0 ? '0,186 - POSITIVO' : '1,674 - Negativo', 1004],
  ]
  for (const [cod, name, res, base] of serologies) {
    descres.push(...rows('2026-07-22', 219, order, a, cod, 'SANGRE', 'METODO LABORATORIAL: ELISA',
      base + i * 2, 1, [['N', name, res, '', '', 'S']]))
  }
})

// 260722/220 — 50 cows, generated exactly like the design prototype's rodeo()
// (diseno/prototipo/portal-datos.js): 8 findings in 7 animals. The first 4
// tags and serologies are the same as 260722/219.
function herdOf50(): [tag: string, hardjo: string, pomona: string, ibr: string, dvb: string][] {
  let seed = 20260722
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  const tags = ['154983', '151667', '126', '105']
  const used = new Set(tags)
  while (tags.length < 50) {
    const c = rnd() < 0.3 ? String(100 + Math.floor(rnd() * 900)) : String(150000 + Math.floor(rnd() * 9000))
    if (!used.has(c)) { used.add(c); tags.push(c) }
  }
  const hardjo: Record<number, string> = { 1: '1/400', 9: '1/200', 17: '1/800', 23: '1/400', 31: '1/100', 38: '1/200' }
  const pomona: Record<number, string> = { 9: '1/100', 44: '1/400' }
  const ibr0 = ['79% - POSITIVO', '100% - POSITIVO', '80% - POSITIVO', '12% - Negativo']
  const dvb0 = ['0,186 - POSITIVO', '1,674 - Negativo', '1,674 - Negativo', '1,674 - Negativo']
  return tags.map((tag, i) => {
    const pct = Math.floor(rnd() * 100)
    const r = rnd()
    const ibr = ibr0[i] || (pct >= 55 ? `${pct}% - POSITIVO` : `${pct}% - Negativo`)
    const dvb = dvb0[i] || (r < 0.08 ? `0,${100 + Math.floor(rnd() * 300)} - POSITIVO`
      : `${(1.2 + rnd() * 0.8).toFixed(3).replace('.', ',')} - Negativo`)
    return [tag, hardjo[i] ?? '', pomona[i] ?? '', ibr, dvb]
  })
}
herdOf50().forEach(([tag, hardjo, pomona, ibr, dvb], i) => {
  const order = i + 1
  const a = cow(tag)
  descres.push(...rows('2026-07-22', 220, order, a, 55, 'SANGRE', 'OBSERVACION: SGC-PROTEC-M-04 Microaglutinación',
    4 + i * 16, 2, [
      ['S', 'LEPTOSPIROSIS', '', '', '', 'S'],
      ['N', 'Grippotyphosa', 'Negativo', '', 'Negativo', 'S'],
      ['N', 'Hardjo', hardjo || 'Negativo', '', 'Negativo', hardjo ? 'N' : 'S'],
      ['N', 'Pomona', pomona || 'Negativo', '', 'Negativo', pomona ? 'N' : 'S'],
    ]))
  const serologies: [number, string, string, number][] = [
    [49, 'INFORME DE BRUCELOSIS', 'Negativo', 804],
    [53, 'IBR (ELISA)', ibr, 904],
    [51, 'DVB (ELISA)', dvb, 1004],
  ]
  for (const [cod, name, res, base] of serologies) {
    descres.push(...rows('2026-07-22', 220, order, a, cod, 'SANGRE', 'METODO LABORATORIAL: ELISA',
      base + i * 2, 1, [['N', name, res, '', '', 'S']]))
  }
})

// 260723/13 — four pets with different analyses (clinic 424): herdMatrix is null.
const pet = (name: string, sex: string, breed: string, species: string): Animal =>
  ({ ANIMAL: name, SEXOC: sex, RAZA: breed, EDAD: '5.00 Años', ESPECIE: species, PELAJE: 'SIN PELAJE' })
descres.push(
  ...rows('2026-07-23', 13, 1, pet('TOBY', 'Macho', 'BEAGLE', 'CANINA'), 2423, 'SANGRE', METHOD_HS, 5, 5, hemogram('18.2', 'S')),
  ...rows('2026-07-23', 13, 2, pet('LUNA', 'Hembra', 'SIAMES', 'FELINA'), 57, 'SUERO', 'METODO LABORATORIAL: ELISA', 105, 5, [
    ['S', 'SEROLOGIA', '', '', '', 'S'],
    ['N', 'Toxoplasma gondii', 'POSITIVO', '', 'Negativo', 'N'],
  ]),
  ...rows('2026-07-23', 13, 3, pet('MAX', 'Macho', 'C.M', 'CANINA'), 49, 'SANGRE', '', 205, 5, [
    ['N', 'INFORME DE BRUCELOSIS', 'Negativo', '', '', 'S'],
  ]),
  ...rows('2026-07-23', 13, 4, pet('NALA', 'Hembra', 'C.M', 'CANINA'), 2423, 'SANGRE', METHOD_HS, 305, 5, hemogram('21.0', 'N')),
)

// 260723/30 — results under a key two clinics share.
descres.push(...rows('2026-07-23', 30, 1, pet('COMPARTIDO', 'Macho', 'C.M', 'CANINA'), 49, 'SANGRE', '', 5, 5, [
  ['N', 'INFORME DE BRUCELOSIS', 'Negativo', '', '', 'S'],
]))

// Clinic 3100: 18 orders a day from 07-28 back to 07-01, numbered down so the list
// order is generation order (260728/2000 first, 260701/1500 the one over the cap).
// The five on 07-24 at list positions 73-77 (page 2) have results.
for (let i = 0; i <= 500; i++) {
  const date = `2026-07-${String(28 - Math.floor(i / 18)).padStart(2, '0')}`
  const nro = 2000 - i
  pedidos.push(P(date, nro, 3100))
  if (i >= 72 && i <= 76) {
    descres.push(...rows(date, nro, 1, cow(`T${nro}`), 49, 'SANGRE', '', 5, 5, [
      ['N', 'INFORME DE BRUCELOSIS', 'Negativo', '', '', 'S'],
    ]))
  }
}

// Shuffle on purpose (deterministically): the portal must sort by itself.
descres.reverse()
descres.sort((x, y) => (Number(x.NROSEC) % 3) - (Number(y.NROSEC) % 3))

export const SEED: { table: string; rows: Row[] }[] = [
  { table: 'clini_vet', rows: clini_vet },
  { table: 'pedidos', rows: pedidos },
  { table: 'descres', rows: descres },
]
