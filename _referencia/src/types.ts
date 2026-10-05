/**
 * Formas de las tablas, VERIFICADAS contra la MySQL del laboratorio
 * (sondas v4 y v5). Solo las columnas que usa el portal.
 *
 * mysql2 devuelve DECIMAL como string y, con dateStrings, DATE como
 * 'YYYY-MM-DD'. sqlite devuelve números y texto. Por eso los numéricos se
 * tipan `number | string` y se normalizan en repo.ts.
 */
type Num = number | string

/** `descres`: resultados ya desnormalizados para imprimir. */
export interface DescresRow {
  FEC_PED: string           // date — fecha de recepción del pedido
  NROMOV: Num               // nro de recepción del día
  CODANAL: Num              // código de análisis
  NROSEC: Num               // línea dentro del análisis
  ORDEN: Num                // EL ANIMAL dentro del pedido (1, 2, 3…), no el orden de impresión
  UBICACION: Num            // EL ORDEN DE IMPRESIÓN, único dentro del pedido
  ANIMAL: string | null     // nombre o caravana
  MATERIAL: string | null
  TITULO: string | null     // 'S' = título de sección
  NOMANAL: string | null    // nombre del análisis
  NOMRESULTA: string | null // nombre de la prueba
  OBSERVA: string | null    // método / observación del análisis
  RESULTADO: string | null
  RELATIVA: string | null   // segundo valor (ej. recuento absoluto)
  MEDIDA: string | null     // unidad del valor relativo ('/mm3')
  REFERENCIA: string | null // rango de referencia (puede traer saltos de línea)
  UNIDAD: string | null
  DENTRO: string | null     // 'N' = fuera de rango
  SEXOC: string | null
  RAZA: string | null
  EDAD: string | null
  ESPECIE: string | null
  PELAJE: string | null
}

/** `pedidos`: cabecera del pedido. Es lo que une resultado con clínica. */
export interface PedidoRow {
  FECHA_RECE: string
  NRO_RECEPC: Num
  REFERENCIA: string | null  // la etiqueta impresa: '260728/160'
  CLINICA: Num
  VETERINARI: Num
  FECHA_EXTR: string | null
  FECHA_ENTR: string | null  // entrega prevista
  URGENTE: string | null
}

/** `clini_vet`: las clínicas. */
export interface ClinicaRow {
  CODIGO: Num
  NOMBRE: string | null
  TELEFONO: string | null
  CORREO: string | null
  HABILITA: string | null
  MOROSO: string | null
}

export interface Clinica {
  codigo: number
  nombre: string
}

/** Una línea del informe. */
export interface Linea {
  tipo: 'seccion' | 'medicion'
  prueba: string
  valor: string
  unidad: string
  relativo: string
  rango: string
  fuera: boolean
}

/** Un análisis dentro del informe de un animal (Hemograma, Leptospirosis…). */
export interface Analisis {
  nombre: string
  material: string
  metodo: string
  lineas: Linea[]
}

/** Lo de un animal. Un pedido puede traer decenas (rodeos, ferias). */
export interface InformeAnimal {
  orden: number
  identificacion: string
  sexo: string
  raza: string
  edad: string
  especie: string
  pelaje: string
  analisis: Analisis[]
  fueraDeRango: number
}

/** Un pedido completo, listo para dibujar. */
export interface Informe {
  fecPed: string
  nroMov: number
  referencia: string
  fechaEntrega: string | null
  animales: InformeAnimal[]
  fueraDeRango: number
}

export type EstadoPedido = 'disponible' | 'en_proceso' | 'fuera_de_ventana'

/** Una fila del listado de pedidos de la clínica. */
export interface ResumenPedido {
  fecPed: string
  nroMov: number
  referencia: string
  estado: EstadoPedido
  fechaEntrega: string | null
  urgente: boolean
  animales: string[]
  analisis: string[]
  fueraDeRango: number
}
