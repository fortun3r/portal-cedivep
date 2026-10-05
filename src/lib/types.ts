/**
 * Table shapes, VERIFIED against the lab's MySQL (probes v4 and v5). Only the
 * columns the portal uses.
 *
 * mysql2 returns DECIMAL as string and, with dateStrings, DATE as 'YYYY-MM-DD'.
 * sqlite returns numbers and text. That's why numeric columns are typed
 * `number | string` and normalized in repo.ts / report.ts.
 */
type Num = number | string

/** `descres`: results, already denormalized for printing. */
export interface DescresRow {
  FEC_PED: string           // date — order reception date
  NROMOV: Num               // reception number of the day
  CODANAL: Num              // analysis code
  NROSEC: Num               // line within the analysis
  ORDEN: Num                // THE ANIMAL within the order (1, 2, 3…), not the print order
  UBICACION: Num            // THE PRINT ORDER, unique within the order
  ANIMAL: string | null     // name or ear tag
  MATERIAL: string | null
  TITULO: string | null     // 'S' = section title
  NOMANAL: string | null    // analysis name
  NOMRESULTA: string | null // test name
  OBSERVA: string | null    // method / note of the analysis
  RESULTADO: string | null
  RELATIVA: string | null   // second value (e.g. absolute count)
  MEDIDA: string | null     // unit of the relative value ('/mm3')
  REFERENCIA: string | null // reference range (may contain line breaks)
  UNIDAD: string | null
  DENTRO: string | null     // 'N' = out of range
  SEXOC: string | null
  RAZA: string | null
  EDAD: string | null
  ESPECIE: string | null
  PELAJE: string | null
}

/** `pedidos`: order header. It is what links a result to a clinic. */
export interface PedidoRow {
  FECHA_RECE: string
  NRO_RECEPC: Num
  REFERENCIA: string | null  // the printed label: '260728/160'
  CLINICA: Num
  VETERINARI: Num
  FECHA_EXTR: string | null
  FECHA_ENTR: string | null  // expected delivery
  URGENTE: string | null
}

/** `clini_vet`: the clinics. */
export interface ClinicaRow {
  CODIGO: Num
  NOMBRE: string | null
  TELEFONO: string | null
  CORREO: string | null
  HABILITA: string | null
  MOROSO: string | null
}

export interface Clinic {
  code: number
  name: string
}

/** One line of the report. */
export interface Line {
  kind: 'section' | 'measurement'
  name: string
  value: string
  unit: string
  relative: string
  range: string
  outOfRange: boolean
}

/** One analysis within an animal's report (Hemograma, Leptospirosis…). */
export interface Analysis {
  name: string
  material: string
  method: string
  lines: Line[]
}

/** One animal. An order can bring dozens (herds, fairs). */
export interface AnimalReport {
  order: number
  id: string
  sex: string
  breed: string
  age: string
  species: string
  coat: string
  analyses: Analysis[]
  outOfRange: number
}

/** A complete order, ready to render. */
export interface Report {
  receivedOn: string
  number: number
  label: string
  deliveryDate: string | null
  animals: AnimalReport[]
  outOfRange: number
}

export type OrderStatus = 'available' | 'in_progress' | 'outside_window'

/** One row of the clinic's order list. */
export interface OrderSummary {
  receivedOn: string
  number: number
  label: string
  status: OrderStatus
  deliveryDate: string | null
  urgent: boolean
  animals: string[]
  analyses: string[]
  outOfRange: number
}
