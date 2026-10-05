/**
 * Las consultas. Todo lo que el portal lee de la base pasa por acá.
 *
 * El portal es de SOLO LECTURA: no escribe una sola fila en la base del
 * laboratorio. Los códigos de ingreso y las sesiones viven en memoria del
 * servidor (auth.ts). Por eso alcanza con un usuario SELECT-only.
 *
 * La unión resultado → clínica, verificada al 99,97 % contra la base real:
 *   descres (FEC_PED, NROMOV) = pedidos (FECHA_RECE, NRO_RECEPC) → CLINICA
 */
import { config } from './config.js'
import { correosDe, telefonosDe } from './contacto.js'
import type { Db } from './db.js'
import { armarInforme, fecha, resumirPedidos } from './informe.js'
import type { Clinica, ClinicaRow, DescresRow, Informe, PedidoRow, ResumenPedido } from './types.js'

/** Pedidos que el laboratorio anuló o borró no se muestran nunca. */
const VIGENTE = `COALESCE(p.ANULADO, '') <> 'S' AND COALESCE(p.BORRADO, '') <> 'S'`

const JOIN = `p.FECHA_RECE = d.FEC_PED AND p.NRO_RECEPC = d.NROMOV`

const COLS_PEDIDO = `p.FECHA_RECE, p.NRO_RECEPC, p.REFERENCIA, p.CLINICA, p.VETERINARI,
  p.FECHA_EXTR, p.FECHA_ENTR, p.URGENTE`

const COLS_DESCRES = `d.FEC_PED, d.NROMOV, d.CODANAL, d.NROSEC, d.ORDEN, d.UBICACION,
  d.ANIMAL, d.MATERIAL, d.TITULO, d.NOMANAL, d.NOMRESULTA, d.OBSERVA, d.RESULTADO,
  d.RELATIVA, d.MEDIDA, d.REFERENCIA, d.UNIDAD, d.DENTRO,
  d.SEXOC, d.RAZA, d.EDAD, d.ESPECIE, d.PELAJE`

// ───────────────────────────────────────────── ventana de resultados

let ventana: { desde: string | null; hasta: string | null; leida: number } | null = null

/**
 * La MySQL tiene una ventana móvil de `descres` (12 días en la sonda v5).
 * Se cachea 10 minutos.
 */
export async function ventanaResultados(db: Db) {
  if (!ventana || Date.now() - ventana.leida > 10 * 60_000) {
    const [r] = await db.all<{ desde: string; hasta: string }>(
      `SELECT MIN(FEC_PED) AS desde, MAX(FEC_PED) AS hasta FROM descres`,
    )
    ventana = { desde: fecha(r?.desde), hasta: fecha(r?.hasta), leida: Date.now() }
  }
  return ventana
}

// ───────────────────────────────────────────── pedidos e informes

export async function listarPedidos(db: Db, clinica: number, limite = 500): Promise<ResumenPedido[]> {
  const pedidos = await db.all<PedidoRow>(
    `SELECT ${COLS_PEDIDO} FROM pedidos p
      WHERE p.CLINICA = ? AND ${VIGENTE}
      ORDER BY p.FECHA_RECE DESC, p.NRO_RECEPC DESC
      LIMIT ${Math.max(1, Math.min(2000, Math.floor(limite)))}`,
    [clinica],
  )
  if (!pedidos.length) return []

  const filas = await db.all<DescresRow>(
    `SELECT d.FEC_PED, d.NROMOV, d.ANIMAL, d.NOMANAL, d.NOMRESULTA, d.TITULO,
            d.DENTRO, d.RESULTADO, d.ORDEN, d.CODANAL, d.UBICACION
       FROM descres d JOIN pedidos p ON ${JOIN}
      WHERE p.CLINICA = ? AND ${VIGENTE}`,
    [clinica],
  )
  const { desde } = await ventanaResultados(db)
  return resumirPedidos(pedidos, filas, desde)
}

/**
 * Un informe completo. La condición `CLINICA = ?` es la autorización: una
 * clínica que cambie la URL a un pedido ajeno recibe null (→ 404), nunca el
 * informe. Hay un test que lo verifica.
 */
export async function obtenerInforme(
  db: Db, clinica: number, fecPed: string, nroMov: number,
): Promise<Informe | null> {
  if (!fecha(fecPed) || !Number.isInteger(nroMov) || nroMov <= 0) return null

  const [pedido] = await db.all<PedidoRow>(
    `SELECT ${COLS_PEDIDO} FROM pedidos p
      WHERE p.FECHA_RECE = ? AND p.NRO_RECEPC = ? AND p.CLINICA = ? AND ${VIGENTE}`,
    [fecPed, nroMov, clinica],
  )
  if (!pedido) return null

  const filas = await db.all<DescresRow>(
    `SELECT ${COLS_DESCRES} FROM descres d WHERE d.FEC_PED = ? AND d.NROMOV = ?`,
    [fecPed, nroMov],
  )
  return armarInforme(pedido, filas)
}

// ───────────────────────────────────────────── directorio de clínicas

export interface ResultadoBusqueda {
  clinicas: Clinica[]
  /** Por qué no se puede entrar, si no se puede. Para el log, no para el usuario. */
  motivo?: 'sin_coincidencia' | 'contacto_compartido'
}

/**
 * Índice contacto → clínicas, armado una vez desde `clini_vet` (4.312 filas,
 * nada) y refrescado cada 10 minutos. Se hace en memoria porque los teléfonos
 * están cargados con formatos imposibles de comparar en SQL ('0981 163 342',
 * '981-163.342'…).
 */
export class DirectorioClinicas {
  private indice = new Map<string, Clinica[]>()
  private compartidos = new Set<string>()
  private leido = 0
  private ultimoRefrescoForzado = 0

  constructor(private db: Db) {}

  async cargar() {
    const filas = await this.db.all<ClinicaRow>(
      `SELECT CODIGO, NOMBRE, TELEFONO, CORREO, HABILITA, MOROSO FROM clini_vet`,
    )
    const a = config.auth
    const indice = new Map<string, Clinica[]>()
    for (const f of filas) {
      const codigo = Number(f.CODIGO)
      if (!Number.isInteger(codigo) || (a.clinicasComodin as readonly number[]).includes(codigo)) continue
      if (a.bloquearDeshabilitadas && String(f.HABILITA ?? '').trim().toUpperCase() === 'N') continue
      if (a.bloquearMorosos && String(f.MOROSO ?? '').trim().toUpperCase() === 'S') continue
      const clinica = { codigo, nombre: String(f.NOMBRE ?? '').trim() || `Clínica ${codigo}` }
      const claves = [
        ...telefonosDe(f.TELEFONO).map((t) => `tel:${t}`),
        ...correosDe(f.CORREO).map((c) => `mail:${c}`),
      ]
      for (const k of new Set(claves)) {
        if (!indice.has(k)) indice.set(k, [])
        indice.get(k)!.push(clinica)
      }
    }
    this.compartidos = new Set(
      [...indice].filter(([, cs]) => cs.length > a.maxClinicasPorContacto).map(([k]) => k),
    )
    for (const k of this.compartidos) indice.delete(k)
    this.indice = indice
    this.leido = Date.now()
    return { clinicas: filas.length, contactos: indice.size, compartidos: this.compartidos.size }
  }

  async buscar(clave: string): Promise<ResultadoBusqueda> {
    if (Date.now() - this.leido > 10 * 60_000) await this.cargar()
    let r = this.resolver(clave)
    // Una clínica recién dada de alta: refrescar una vez (como mucho 1 por minuto).
    if (r.motivo === 'sin_coincidencia' && Date.now() - this.ultimoRefrescoForzado > 60_000) {
      this.ultimoRefrescoForzado = Date.now()
      await this.cargar()
      r = this.resolver(clave)
    }
    return r
  }

  private resolver(clave: string): ResultadoBusqueda {
    if (this.compartidos.has(clave)) return { clinicas: [], motivo: 'contacto_compartido' }
    const cs = this.indice.get(clave)
    return cs?.length ? { clinicas: cs } : { clinicas: [], motivo: 'sin_coincidencia' }
  }
}

// ───────────────────────────────────────────── diagnóstico

export async function diagnostico(db: Db) {
  const contar = async (t: string) => {
    try { return Number((await db.all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))[0].n) }
    catch { return null }
  }
  return {
    descres: await contar('descres'),
    pedidos: await contar('pedidos'),
    clini_vet: await contar('clini_vet'),
    ventana: await ventanaResultados(db),
  }
}
