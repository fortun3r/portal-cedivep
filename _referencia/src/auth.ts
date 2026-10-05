/**
 * Ingreso sin contraseñas: la clínica pone su celular o correo, le llega un
 * código de 6 dígitos, lo tipea y entra.
 *
 * Por qué no contraseñas: son 4.312 clínicas, y el precedente en la casa
 * (cobrador.CLAVE) es una sola clave '1234' compartida por todos. Un código
 * de un solo uso no hay que administrarlo, recordarlo ni resetearlo.
 *
 * Todo vive en memoria del proceso: códigos, límites de intentos y nada más.
 * La sesión va en una cookie firmada (HMAC), así el servidor no guarda estado
 * de sesión y la base del laboratorio sigue siendo de solo lectura.
 * Limitación conocida: con más de una instancia del servidor, los códigos
 * pendientes no se comparten. Para el volumen del laboratorio, una alcanza.
 */
import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { config } from './config.js'
import type { Clinica } from './types.js'

const A = config.auth
const ahora = () => Date.now()
const sha = (s: string) => createHash('sha256').update(s).digest()

// ─────────────────────────────────────────────────── límites de uso

/** Contador de eventos en ventana deslizante. */
export class Limite {
  private eventos = new Map<string, number[]>()
  constructor(private max: number, private ventanaMs: number) {}

  /** Registra un intento. Devuelve false si ya se pasó del límite. */
  permitir(clave: string): boolean {
    const desde = ahora() - this.ventanaMs
    const evs = (this.eventos.get(clave) ?? []).filter((t) => t > desde)
    if (evs.length >= this.max) {
      this.eventos.set(clave, evs)
      return false
    }
    evs.push(ahora())
    this.eventos.set(clave, evs)
    return true
  }

  limpiar() {
    const desde = ahora() - this.ventanaMs
    for (const [k, evs] of this.eventos) {
      const vivos = evs.filter((t) => t > desde)
      if (vivos.length) this.eventos.set(k, vivos)
      else this.eventos.delete(k)
    }
  }
}

// ─────────────────────────────────────────────────── códigos de ingreso

interface CodigoPendiente {
  hash: Buffer
  clinicas: Clinica[]
  expira: number
  intentos: number
}

export type ResultadoEmision =
  | { ok: true; codigo: string }
  | { ok: false; motivo: 'limite_contacto' | 'limite_ip' }

export type ResultadoVerificacion =
  | { ok: true; clinicas: Clinica[] }
  | { ok: false; motivo: 'sin_codigo' | 'vencido' | 'incorrecto' | 'agotado' }

export class Codigos {
  private pendientes = new Map<string, CodigoPendiente>()
  readonly porContacto = new Limite(A.codigosPorContacto, A.ventanaMinutos * 60_000)
  readonly porIp = new Limite(A.pedidosPorIp, A.ventanaMinutos * 60_000)

  /**
   * Chequea los límites de uso. Se llama SIEMPRE, exista o no el contacto,
   * para que los límites no revelen qué contactos están registrados.
   */
  admitir(clave: string, ip: string): ResultadoEmision | null {
    if (!this.porIp.permitir(ip)) return { ok: false, motivo: 'limite_ip' }
    if (!this.porContacto.permitir(clave)) return { ok: false, motivo: 'limite_contacto' }
    return null
  }

  /** Genera un código nuevo para ese contacto (invalida el anterior). */
  emitir(clave: string, clinicas: Clinica[]): ResultadoEmision {
    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
    this.pendientes.set(clave, {
      hash: sha(`${clave}|${codigo}`),
      clinicas,
      expira: ahora() + A.codigoMinutos * 60_000,
      intentos: 0,
    })
    return { ok: true, codigo }
  }

  verificar(clave: string, codigo: string): ResultadoVerificacion {
    const p = this.pendientes.get(clave)
    if (!p) return { ok: false, motivo: 'sin_codigo' }
    if (ahora() > p.expira) {
      this.pendientes.delete(clave)
      return { ok: false, motivo: 'vencido' }
    }
    p.intentos++
    const limpio = codigo.replace(/\D/g, '')
    if (limpio.length === 6 && timingSafeEqual(sha(`${clave}|${limpio}`), p.hash)) {
      this.pendientes.delete(clave)        // un solo uso
      return { ok: true, clinicas: p.clinicas }
    }
    if (p.intentos >= A.codigoIntentos) {
      this.pendientes.delete(clave)
      return { ok: false, motivo: 'agotado' }
    }
    return { ok: false, motivo: 'incorrecto' }
  }

  /** Mantenimiento: borra lo vencido. Se llama cada pocos minutos. */
  limpiar() {
    for (const [k, p] of this.pendientes) if (ahora() > p.expira) this.pendientes.delete(k)
    this.porContacto.limpiar()
    this.porIp.limpiar()
  }
}

// ─────────────────────────────────────────────────── cookies firmadas

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')
const hmac = (s: string) => createHmac('sha256', A.sessionSecret).update(s).digest()

export function firmar(datos: object, minutos: number): string {
  const cuerpo = b64(JSON.stringify({ ...datos, exp: ahora() + minutos * 60_000 }))
  return `${cuerpo}.${b64(hmac(cuerpo))}`
}

export function leerFirmado<T>(valor: string | undefined): T | null {
  if (!valor) return null
  const [cuerpo, firma] = valor.split('.')
  if (!cuerpo || !firma) return null
  const esperada = hmac(cuerpo)
  const recibida = Buffer.from(firma, 'base64url')
  if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) return null
  try {
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))
    if (typeof datos?.exp !== 'number' || ahora() > datos.exp) return null
    return datos as T
  } catch {
    return null
  }
}

/** La sesión: a qué clínicas puede entrar y en cuál está parada. */
export interface Sesion {
  habilitadas: Clinica[]
  actual?: Clinica
}

/** El paso intermedio, entre pedir el código y tipearlo. */
export interface PasoCodigo {
  clave: string
  /** Solo en modo demo: el código, para mostrarlo en pantalla. */
  demo?: string
}

export function parsearCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const parte of (header ?? '').split(';')) {
    const i = parte.indexOf('=')
    if (i > 0) out[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim())
  }
  return out
}
