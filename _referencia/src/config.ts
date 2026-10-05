/**
 * Configuración. Todo lo que cambia entre el demo local y la base real del
 * laboratorio vive acá, y se lee del entorno (.env). Ninguna credencial en el
 * código: el sistema viejo las tiene incrustadas en inicio.prg y compiladas en
 * 106 ejecutables; acá no repetimos eso.
 */
import { randomBytes } from 'node:crypto'

export type Driver = 'sqlite' | 'mysql'

const env = process.env
const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d)
const bool = (v: string | undefined, d: boolean) => (v === undefined ? d : /^(1|true|si|sí|yes)$/i.test(v))

const driver = (env.CEDIVEP_DRIVER ?? 'sqlite') as Driver

/**
 * Modo demo: los códigos de ingreso se muestran en pantalla en vez de mandarse
 * por WhatsApp. Por defecto está prendido solo con el driver sqlite.
 * NUNCA prenderlo con datos reales expuestos a internet.
 */
const demo = bool(env.CEDIVEP_DEMO, driver === 'sqlite')

const secretFromEnv = env.SESSION_SECRET ?? ''

export const config = {
  driver,
  demo,
  port: num(env.PORT, 3000),

  /** Detrás de un proxy (nginx, Cloudflare) para leer la IP real del cliente. */
  trustProxy: bool(env.TRUST_PROXY, false),
  /** Cookies solo por HTTPS. Prenderlo en producción. */
  cookieSecure: bool(env.COOKIE_SECURE, false),

  mysql: {
    host: env.DB_HOST ?? '',
    port: num(env.DB_PORT, 3309),
    user: env.DB_USER ?? '',
    password: env.DB_PASSWORD ?? '',
    database: env.DB_NAME ?? 'cedivep',
    connectTimeout: 15_000,
  },

  auth: {
    /**
     * Firma de la cookie de sesión. En demo se genera una al azar en cada
     * arranque (las sesiones se pierden al reiniciar, y está bien).
     */
    sessionSecret: secretFromEnv || randomBytes(32).toString('hex'),
    sessionSecretIsEphemeral: !secretFromEnv,
    sessionHoras: num(env.SESSION_HORAS, 12),

    codigoMinutos: 10,          // vida del código de ingreso
    codigoIntentos: 5,          // intentos para tipearlo bien
    codigosPorContacto: 3,      // códigos pedidos por contacto…
    ventanaMinutos: 15,         // …en esta ventana
    pedidosPorIp: 20,           // pedidos de código por IP en la ventana

    /**
     * Códigos de clínica que NO son una clínica sino un comodín. En `pedidos`,
     * CLINICA=1 son los particulares (9 % de los pedidos). Si alguien pudiera
     * entrar como "clínica 1" vería los resultados de TODOS los particulares.
     */
    clinicasComodin: [0, 1],

    /**
     * Un mismo teléfono o correo cargado en muchas clínicas suele ser un dato
     * de relleno (el teléfono del laboratorio, el de un cobrador). Por encima
     * de este número no se permite entrar con ese contacto.
     */
    maxClinicasPorContacto: 5,

    /** Política de negocio, a confirmar con Olga. */
    bloquearMorosos: bool(env.BLOQUEAR_MOROSOS, false),
    bloquearDeshabilitadas: bool(env.BLOQUEAR_DESHABILITADAS, true),
  },

  /**
   * Valores centinela de `descres`, VERIFICADOS contra la base real
   * (sonda v2, 13/08/2026, 93.460 filas). Ver hallazgos_descres.md.
   */
  sentinels: {
    /** 'S' = fila de título de sección (7.379 filas); 'N' = medición (86.081). */
    esTitulo: (v: unknown) => String(v ?? '').trim().toUpperCase() === 'S',
    /** 'N' = fuera del rango de referencia (12.609 filas); 'S' = dentro (80.851). */
    fueraDeRango: (v: unknown) => String(v ?? '').trim().toUpperCase() === 'N',
    /** Valores de relleno que el sistema viejo graba cuando no hay dato. */
    vacios: new Set(['', '0', 'SIN PELAJE', 'SS', 'S/D', '0000-00-00']),
  },

  lab: {
    nombre: 'CEDIVEP S.R.L.',
    subtitulo: 'Centro de Diagnóstico Veterinario del Paraguay',
    habilitacion: '114-SENACSA',
  },
} as const
