/**
 * Cómo le llega el código de ingreso a la clínica.
 *
 * Hoy hay un solo canal implementado: la consola del servidor (y, en modo
 * demo, la pantalla). Mandarlo por WhatsApp de verdad requiere una cuenta de
 * WhatsApp Business API (Meta) o un proveedor (Twilio, etc.) — eso es una
 * decisión del laboratorio, con costo por mensaje. Cuando esté, se agrega un
 * Notificador más; nada del resto del portal cambia.
 */
import { enmascarar } from './contacto.js'
import type { Clinica } from './types.js'

export interface Notificador {
  nombre: string
  enviar(clave: string, codigo: string, clinicas: Clinica[]): Promise<void>
}

export const notificadorConsola: Notificador = {
  nombre: 'consola',
  async enviar(clave, codigo, clinicas) {
    const quien = clinicas.map((c) => `${c.codigo} ${c.nombre}`).join(', ')
    console.log(`[ingreso] código ${codigo} para ${enmascarar(clave)} → ${quien}`)
  },
}
