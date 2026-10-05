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

// Shuffle on purpose (deterministically): the portal must sort by itself.
descres.reverse()
descres.sort((x, y) => (Number(x.NROSEC) % 3) - (Number(y.NROSEC) % 3))

export const SEED: { table: string; rows: Row[] }[] = [
  { table: 'clini_vet', rows: clini_vet },
  { table: 'pedidos', rows: pedidos },
  { table: 'descres', rows: descres },
]
