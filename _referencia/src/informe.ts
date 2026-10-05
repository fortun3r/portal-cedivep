/**
 * Arma el informe a partir de las filas de `descres`. Funciones puras, sin base
 * de datos, para poder testearlas.
 *
 * Lo que se aprendió de los datos reales (hallazgos_descres.md):
 *  - `UBICACION` es el orden de impresión. NO `ORDEN` ni `NROSEC`: con NROSEC
 *    los distintos análisis de un mismo animal se entremezclan.
 *  - `ORDEN` identifica al ANIMAL. Un pedido puede traer un rodeo entero
 *    (hay uno real con 650 filas y 24 páginas).
 *  - `CODANAL` agrupa un análisis completo: el hemograma (2423) trae dos
 *    secciones, BIOMETRIA HEMATICA y LEUCOGRAMA.
 *  - `TITULO`='S' es un título de sección; `DENTRO`='N' está fuera de rango.
 */
import { config } from './config.js'
import type {
  Analisis, DescresRow, EstadoPedido, Informe, InformeAnimal, Linea, PedidoRow, ResumenPedido,
} from './types.js'

const { esTitulo, fueraDeRango, vacios } = config.sentinels

/** Texto limpio, o '' si es un valor de relleno del sistema viejo. */
export function limpio(v: unknown): string {
  const s = String(v ?? '').replace(/\r/g, '').trim()
  return vacios.has(s.toUpperCase()) ? '' : s
}

const n = (v: unknown) => Number(v ?? 0) || 0

/**
 * Los números como en el informe impreso: la base guarda '7826000' y '11.6',
 * el papel dice '7.826.000' y '11,6'. Solo se tocan valores puramente
 * numéricos; '79% - POSITIVO', '1/400' o '0,186' quedan como están. Los ceros
 * a la izquierda ('00', '03') también, porque así se imprimen.
 */
export function formatoNumero(v: string): string {
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(v.trim())
  if (!m) return v
  const [, signo, entero, decimales] = m
  if (entero.length > 1 && entero.startsWith('0')) return v
  const miles = entero.length >= 4 ? entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : entero
  return signo + miles + (decimales !== undefined ? `,${decimales}` : '')
}

function linea(r: DescresRow): Linea {
  if (esTitulo(r.TITULO)) {
    return {
      tipo: 'seccion', prueba: limpio(r.NOMRESULTA) || limpio(r.NOMANAL),
      valor: '', unidad: '', relativo: '', rango: '', fuera: false,
    }
  }
  const valor = String(r.RESULTADO ?? '').trim()
  const relativa = limpio(r.RELATIVA)
  return {
    tipo: 'medicion',
    prueba: limpio(r.NOMRESULTA) || limpio(r.NOMANAL),
    valor: formatoNumero(valor),
    unidad: limpio(r.UNIDAD),
    relativo: relativa ? [formatoNumero(relativa), limpio(r.MEDIDA)].filter(Boolean).join(' ') : '',
    rango: limpio(r.REFERENCIA),
    // Un "fuera de rango" sin valor no es un hallazgo: es un dato sin cargar.
    fuera: fueraDeRango(r.DENTRO) && valor !== '',
  }
}

/** Agrupa las filas de un animal en análisis, respetando el orden de impresión. */
function analisisDe(filas: DescresRow[]): Analisis[] {
  const bloques = new Map<string, DescresRow[]>()
  for (const r of filas) {
    const k = String(n(r.CODANAL))
    if (!bloques.has(k)) bloques.set(k, [])
    bloques.get(k)!.push(r)
  }
  return [...bloques.values()].map((b) => ({
    nombre: limpio(b.find((r) => esTitulo(r.TITULO))?.NOMRESULTA) || limpio(b[0].NOMRESULTA),
    material: limpio(b[0].MATERIAL),
    metodo: [...new Set(b.map((r) => limpio(r.OBSERVA)).filter(Boolean))].join('\n'),
    lineas: b.map(linea),
  }))
}

export function armarInforme(pedido: PedidoRow, filasDesordenadas: DescresRow[]): Informe {
  const filas = [...filasDesordenadas].sort((a, b) => n(a.UBICACION) - n(b.UBICACION))

  const porAnimal = new Map<number, DescresRow[]>()
  for (const r of filas) {
    const o = n(r.ORDEN)
    if (!porAnimal.has(o)) porAnimal.set(o, [])
    porAnimal.get(o)!.push(r)
  }

  const animales: InformeAnimal[] = [...porAnimal.entries()]
    .sort(([a], [b]) => a - b)
    .map(([orden, fs]) => {
      const p = fs[0]
      const analisis = analisisDe(fs)
      return {
        orden,
        identificacion: limpio(p.ANIMAL) || `Animal ${orden}`,
        sexo: limpio(p.SEXOC),
        raza: limpio(p.RAZA),
        edad: limpio(p.EDAD),
        especie: limpio(p.ESPECIE),
        pelaje: limpio(p.PELAJE),
        analisis,
        fueraDeRango: analisis.flatMap((a) => a.lineas).filter((l) => l.fuera).length,
      }
    })

  return {
    fecPed: String(pedido.FECHA_RECE).slice(0, 10),
    nroMov: n(pedido.NRO_RECEPC),
    referencia: etiqueta(pedido),
    fechaEntrega: fecha(pedido.FECHA_ENTR),
    animales,
    fueraDeRango: animales.reduce((s, a) => s + a.fueraDeRango, 0),
  }
}

/** La etiqueta impresa ('260728/160'); si falta, se reconstruye. */
export function etiqueta(p: Pick<PedidoRow, 'REFERENCIA' | 'FECHA_RECE' | 'NRO_RECEPC'>): string {
  const ref = limpio(p.REFERENCIA)
  if (ref) return ref
  const [y, m, d] = String(p.FECHA_RECE).slice(0, 10).split('-')
  return `${y.slice(2)}${m}${d}/${String(n(p.NRO_RECEPC)).padStart(3, ' ')}`
}

/** Fecha 'YYYY-MM-DD' válida, o null (el sistema viejo graba '0000-00-00'). */
export function fecha(v: unknown): string | null {
  const s = String(v ?? '').slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !s.startsWith('0000') ? s : null
}

/**
 * Listado de pedidos con su estado.
 *
 * `ventanaDesde` es la fecha más vieja que hay en `descres`. La MySQL tiene
 * solo una ventana móvil de resultados; un pedido anterior sin resultados NO
 * está "en proceso", simplemente quedó fuera de lo sincronizado.
 */
export function resumirPedidos(
  pedidos: PedidoRow[],
  filasDesordenadas: Pick<DescresRow, 'FEC_PED' | 'NROMOV' | 'ANIMAL' | 'NOMANAL' | 'NOMRESULTA' | 'TITULO' | 'DENTRO' | 'RESULTADO' | 'ORDEN' | 'CODANAL' | 'UBICACION'>[],
  ventanaDesde: string | null,
): ResumenPedido[] {
  const clave = (f: unknown, m: unknown) => `${String(f).slice(0, 10)}|${n(m)}`
  const filas = [...filasDesordenadas].sort((a, b) => n(a.UBICACION) - n(b.UBICACION))
  const porPedido = new Map<string, typeof filas>()
  for (const r of filas) {
    const k = clave(r.FEC_PED, r.NROMOV)
    if (!porPedido.has(k)) porPedido.set(k, [])
    porPedido.get(k)!.push(r)
  }

  return pedidos.map((p) => {
    const fec = String(p.FECHA_RECE).slice(0, 10)
    const fs = porPedido.get(clave(fec, p.NRO_RECEPC)) ?? []
    let estado: EstadoPedido = 'disponible'
    if (!fs.length) estado = ventanaDesde && fec >= ventanaDesde ? 'en_proceso' : 'fuera_de_ventana'

    const animales = [...new Map(fs.map((r) => [n(r.ORDEN), limpio(r.ANIMAL)])).values()].filter(Boolean)
    // Nombre de cada análisis: su título de sección si tiene (LEPTOSPIROSIS),
    // si no su única prueba (INFORME DE BRUCELOSIS). Dos pasadas, porque las
    // filas pueden llegar en cualquier orden.
    const analisis = new Map<number, string>()
    for (const r of fs) {
      if (esTitulo(r.TITULO) && !analisis.has(n(r.CODANAL))) analisis.set(n(r.CODANAL), limpio(r.NOMRESULTA))
    }
    for (const r of fs) {
      if (!analisis.has(n(r.CODANAL))) analisis.set(n(r.CODANAL), limpio(r.NOMRESULTA) || limpio(r.NOMANAL))
    }
    return {
      fecPed: fec,
      nroMov: n(p.NRO_RECEPC),
      referencia: etiqueta(p),
      estado,
      fechaEntrega: fecha(p.FECHA_ENTR),
      urgente: String(p.URGENTE ?? '').trim().toUpperCase() === 'S',
      animales,
      analisis: [...new Set(analisis.values())].filter(Boolean),
      fueraDeRango: fs.filter((r) => !esTitulo(r.TITULO) && fueraDeRango(r.DENTRO)
        && String(r.RESULTADO ?? '').trim() !== '').length,
    }
  })
}

// ───────────────────────────────────────────── rodeos

export interface ColumnaMatriz { seccion: string; prueba: string; rango: string }
export interface Matriz {
  columnas: ColumnaMatriz[]
  filas: { orden: number; animal: string; celdas: { valor: string; fuera: boolean }[]; fuera: number }[]
}

/** Desde cuántos animales un pedido se muestra como rodeo. */
export const RODEO_DESDE = 4

/**
 * Para rodeos: una fila por animal, una columna por prueba. Es como un
 * veterinario lee 50 vacas, no 50 informes uno abajo del otro.
 *
 * Solo aplica si todos los animales tienen exactamente las mismas pruebas, en
 * el mismo orden; si no (un rodeo mixto), devuelve null y se muestra animal
 * por animal.
 */
export function matrizRodeo(inf: Informe): Matriz | null {
  if (inf.animales.length < RODEO_DESDE) return null

  const firma = (a: InformeAnimal) => {
    const cols: ColumnaMatriz[] = []
    for (const an of a.analisis) {
      let seccion = ''
      for (const l of an.lineas) {
        if (l.tipo === 'seccion') seccion = l.prueba
        else cols.push({ seccion, prueba: l.prueba, rango: l.rango })
      }
    }
    return cols
  }
  const columnas = firma(inf.animales[0])
  const clave = (cs: ColumnaMatriz[]) => cs.map((c) => `${c.seccion}|${c.prueba}`).join('\n')
  const k0 = clave(columnas)
  if (!columnas.length || inf.animales.some((a) => clave(firma(a)) !== k0)) return null

  // El rango va en la cabecera solo si es el mismo para todos los animales.
  const rangos = columnas.map((_, i) => new Set(inf.animales.map((a) => firma(a)[i].rango)))
  columnas.forEach((c, i) => { c.rango = rangos[i].size === 1 ? c.rango : '' })

  return {
    columnas,
    filas: inf.animales.map((a) => {
      const celdas = a.analisis.flatMap((an) => an.lineas.filter((l) => l.tipo === 'medicion'))
        .map((l) => ({ valor: [l.valor, l.unidad].filter(Boolean).join(' '), fuera: l.fuera }))
      return { orden: a.orden, animal: a.identificacion, celdas, fuera: a.fueraDeRango }
    }),
  }
}
