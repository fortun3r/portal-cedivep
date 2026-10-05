/**
 * Datos del demo (driver sqlite). Misma forma que las tablas reales y mismos
 * centinelas verificados ('S'/'N'), para que el demo y la base real se
 * comporten igual.
 *
 * Qué cubre, a propósito:
 *  - 260724/5  SHAKIRA: transcripción literal del informe impreso que mostró
 *    Olga el 26/07 (el R.D.W. de 22,5 % fuera de 17,0-20,0).
 *  - 260722/219  un rodeo de 4 vacas, con el orden de impresión real del
 *    laboratorio (UBICACION intercala animales por análisis: 804, 806, 808…).
 *  - un pedido en proceso, uno anulado, uno fuera de la ventana en línea.
 *  - un celular cargado en dos clínicas (→ pantalla para elegir).
 *  - la clínica comodín 1 (particulares), a la que nadie puede entrar.
 *  - las filas se insertan DESORDENADAS: el portal tiene que ordenar por
 *    UBICACION, no confiar en el orden de la tabla.
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

// ───────────────────────────────────────────── clínicas

const clini_vet = [
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

// ───────────────────────────────────────────── pedidos

const P = (fecha: string, nro: number, clinica: number, extra: Record<string, unknown> = {}) => {
  const [y, m, d] = fecha.split('-')
  return {
    FECHA_RECE: fecha, NRO_RECEPC: nro,
    REFERENCIA: `${y.slice(2)}${m}${d}/${String(nro).padStart(3, ' ')}`,
    CLINICA: clinica, VETERINARI: 41, PROPIETARI: 92680,
    FECHA_EXTR: fecha, FECHA_ENTR: fecha, URGENTE: 'N', ANULADO: 'N', BORRADO: 'N',
    ...extra,
  }
}

const pedidos = [
  P('2026-07-24', 5, 2646, { FECHA_ENTR: '2026-07-26' }),
  P('2026-07-24', 2, 2646, { FECHA_ENTR: '2026-07-27' }),
  P('2026-07-22', 219, 2646, { FECHA_ENTR: '2026-07-24' }),
  P('2026-07-28', 40, 2646, { FECHA_ENTR: '2026-07-31', URGENTE: 'S' }),   // en proceso
  P('2026-07-25', 7, 2646, { ANULADO: 'S' }),                               // anulado: no aparece
  P('2026-07-10', 3, 2646),                                                 // fuera de la ventana
  P('2026-07-23', 12, 424, { FECHA_ENTR: '2026-07-25' }),
  P('2026-07-24', 9, 1),                                                    // particular: nadie lo ve
]

// ───────────────────────────────────────────── resultados

type Animal = { ANIMAL: string; SEXOC: string; RAZA: string; EDAD: string; ESPECIE: string; PELAJE: string }
type Linea = [titulo: 'S' | 'N', prueba: string, resultado: string, unidad: string,
              rango: string, dentro: 'S' | 'N', relativa?: string, medida?: string]

let numeroid = 862000
function filas(fec: string, nro: number, orden: number, animal: Animal, codanal: number,
               material: string, observa: string, ubicacion0: number, paso: number, lineas: Linea[]) {
  const id = ++numeroid
  return lineas.map(([titulo, prueba, resultado, unidad, rango, dentro, relativa = '', medida = ''], i) => ({
    NUMEROID: id, FEC_PED: fec, NROMOV: nro, CODANAL: codanal, NROSEC: i + 1, ORDEN: orden,
    UBICACION: ubicacion0 + i * paso, MATERIAL: material, TITULO: titulo,
    NOMANAL: prueba, NOMRESULTA: prueba, OBSERVA: observa, RESULTADO: resultado,
    RELATIVA: relativa, MEDIDA: medida, REFERENCIA: rango, UNIDAD: unidad, DENTRO: dentro,
    ...animal,
  }))
}

const SHAKIRA: Animal = { ANIMAL: 'SHAKIRA', SEXOC: 'Hembra', RAZA: 'MESTIZA', EDAD: '4.00 Años',
                          ESPECIE: 'EQUINA', PELAJE: 'ZAINA' }
const ROCKY: Animal = { ANIMAL: 'ROCKY', SEXOC: 'Macho', RAZA: 'LABRADOR', EDAD: '6.00 Años',
                        ESPECIE: 'CANINA', PELAJE: 'SIN PELAJE' }
const MIA: Animal = { ANIMAL: 'LOLA', SEXOC: 'Hembra', RAZA: 'C.M', EDAD: '3.00 Años',
                      ESPECIE: '', PELAJE: 'SIN PELAJE' }
const vaca = (caravana: string): Animal => ({ ANIMAL: caravana, SEXOC: 'Hembra', RAZA: 'NELORE',
  EDAD: '2.00 Años', ESPECIE: '', PELAJE: 'SIN PELAJE' })

const METODO_HS = 'Método utilizado: SGC-PROTEC-HS-01'

const hemograma = (rdw: string, rdwDentro: 'S' | 'N'): Linea[] => [
  ['S', 'BIOMETRIA HEMATICA', '', '', '', 'S'],
  ['N', 'Hemoglobina', '11.6', 'g/dL', '10,0 - 18,0 g/dL', 'S'],
  ['N', 'Hematócrito', '32', '%', '31 - 45 %', 'S'],
  ['N', 'Glóbulos Rojos', '7826000', 'mm3', '(6 - 10) x 10^6 / mm3', 'S'],
  ['N', 'V.C.M.', '41', 'fl', '39 - 50 fl', 'S'],
  ['N', 'H.C.M.', '14.8', 'pg', '14,0 - 19,0 pg', 'S'],
  ['N', 'C.H.C.M.', '36.3', 'g/dL', '31,0 - 37,0 g/dL', 'S'],
  ['N', 'R.D.W.', rdw, '%', '17,0 - 20,0 %', rdwDentro],
  ['S', 'LEUCOGRAMA', '', '', '', 'S'],
  ['N', 'Glóbulos Blancos', '7500', 'mm3', '(5.5 - 14) x 10^3 / mm3', 'S'],
  ['N', 'Neutrofilos en banda', '00', '%', '0 - 2 %', 'S', '0', '/mm3'],
  ['N', 'Neutrofilos segmentados', '62', '%', '58 - 78 %', 'S', '4650', '/mm3'],
]

const descres = [
  // 260724/5 — SHAKIRA, el informe del video
  ...filas('2026-07-24', 5, 1, SHAKIRA, 2423, 'SANGRE', METODO_HS, 5, 5, hemograma('22.5', 'N')),

  // 260724/2 — ROCKY, serología
  ...filas('2026-07-24', 2, 1, ROCKY, 57, 'SUERO', 'METODO LABORATORIAL: ELISA', 5, 5, [
    ['S', 'SEROLOGIA', '', '', '', 'S'],
    ['N', 'Neospora caninum', 'NEGATIVO', '', 'Negativo', 'S'],
    ['N', 'Toxoplasma gondii', 'POSITIVO', '', 'Negativo', 'N'],
  ]),

  // 260723/12 — LOLA, de la otra clínica
  ...filas('2026-07-23', 12, 1, MIA, 2423, 'SANGRE', METODO_HS, 5, 5, hemograma('13.1', 'S')),

  // 260724/9 — un particular (clínica 1)
  ...filas('2026-07-24', 9, 1, vaca('PARTICULAR-1'), 49, 'SANGRE', '', 5, 5, [
    ['N', 'INFORME DE BRUCELOSIS', 'Negativo', '', '', 'S'],
  ]),
]

// 260722/219 — rodeo de 4 vacas. Orden de impresión como en el laboratorio:
// leptospirosis por animal (4, 20, 36, 52) y las serologías de una línea
// agrupadas por análisis con los animales intercalados (804, 806, 808, 810).
const rodeo = ['154983', '151667', '126', '105']
rodeo.forEach((car, i) => {
  const orden = i + 1
  const a = vaca(car)
  const obsLepto = 'OBSERVACION: SGC-PROTEC-M-04 Microaglutinación'
  descres.push(...filas('2026-07-22', 219, orden, a, 55, 'SANGRE', obsLepto, 4 + i * 16, 2, [
    ['S', 'LEPTOSPIROSIS', '', '', '', 'S'],
    ['N', 'Grippotyphosa', 'Negativo', '', 'Negativo', 'S'],
    ['N', 'Hardjo', i === 1 ? '1/400' : 'Negativo', '', 'Negativo', i === 1 ? 'N' : 'S'],
    ['N', 'Pomona', 'Negativo', '', 'Negativo', 'S'],
  ]))
  const ibr = ['79% - POSITIVO', '100% - POSITIVO', '80% - POSITIVO', '12% - Negativo'][i]
  const serologias: [number, string, string, number][] = [
    [49, 'INFORME DE BRUCELOSIS', 'Negativo', 804],
    [53, 'IBR (ELISA)', ibr, 904],
    [51, 'DVB (ELISA)', i === 0 ? '0,186 - POSITIVO' : '1,674 - Negativo', 1004],
  ]
  for (const [cod, nombre, res, base] of serologias) {
    descres.push(...filas('2026-07-22', 219, orden, a, cod, 'SANGRE', 'METODO LABORATORIAL: ELISA',
      base + i * 2, 1, [['N', nombre, res, '', '', 'S']]))
  }
})

// Desordenar a propósito (determinístico): el portal tiene que ordenar solo.
descres.reverse()
descres.sort((x, y) => (x.NROSEC % 3) - (y.NROSEC % 3))

export const SEED = [
  { tabla: 'clini_vet', filas: clini_vet },
  { tabla: 'pedidos', filas: pedidos },
  { tabla: 'descres', filas: descres },
]
