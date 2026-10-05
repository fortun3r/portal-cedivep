/**
 * Rutas del portal.
 *
 *   GET  /                       ingresar: celular o correo
 *   POST /ingresar               pide el código
 *   GET  /verificar              tipear el código
 *   POST /verificar              entra (o elige clínica si hay varias)
 *   GET  /elegir  POST /elegir   elegir clínica
 *   GET  /pedidos?q=             listado de pedidos de la clínica, con búsqueda
 *   GET  /pedidos/:fecha/:nro    un informe
 *   POST /salir
 *   GET  /health                 diagnóstico: contra qué base corre y qué ve
 */
import express, { type NextFunction, type Request, type Response } from 'express'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Codigos, firmar, leerFirmado, parsearCookies, type PasoCodigo, type Sesion } from './auth.js'
import { config } from './config.js'
import { claveDeContacto, enmascarar } from './contacto.js'
import { openDb, type Db } from './db.js'
import { notificadorConsola, type Notificador } from './notificar.js'
import {
  paginaCodigo, paginaElegir, paginaError, paginaInforme, paginaIngreso, paginaPedidos,
} from './render.js'
import { diagnostico, DirectorioClinicas, listarPedidos, obtenerInforme, ventanaResultados } from './repo.js'
import type { ResumenPedido } from './types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const COOKIE_PASO = 'cedivep_paso'
const COOKIE_SESION = 'cedivep_sesion'

export interface Dependencias {
  db: Db
  directorio?: DirectorioClinicas
  codigos?: Codigos
  notificador?: Notificador
}

/** Minúsculas y sin acentos, para buscar. */
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function coincide(p: ResumenPedido, q: string) {
  const texto = plano([p.referencia, p.fecPed, p.fecPed.split('-').reverse().join('/'),
    ...p.animales, ...p.analisis].join(' '))
  return plano(q).split(/\s+/).filter(Boolean).every((t) => texto.includes(t))
}

export function crearApp(deps: Dependencias) {
  const { db } = deps
  const directorio = deps.directorio ?? new DirectorioClinicas(db)
  const codigos = deps.codigos ?? new Codigos()
  const notificador = deps.notificador ?? notificadorConsola

  const app = express()
  if (config.trustProxy) app.set('trust proxy', 1)
  app.disable('x-powered-by')

  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'",
    })
    next()
  })
  app.use(express.urlencoded({ extended: false, limit: '2kb' }))
  app.use(express.static(join(__dirname, '..', 'public'), { maxAge: '1h' }))

  // ── cookies
  const opcionesCookie = (minutos: number) => ({
    httpOnly: true, sameSite: 'lax' as const, secure: config.cookieSecure, path: '/',
    maxAge: minutos * 60_000,
  })
  const leer = <T>(req: Request, nombre: string) => leerFirmado<T>(parsearCookies(req.headers.cookie)[nombre])
  const guardarSesion = (res: Response, s: Sesion) =>
    res.cookie(COOKIE_SESION, firmar(s, config.auth.sessionHoras * 60), opcionesCookie(config.auth.sessionHoras * 60))

  /** Resultados de salud: nada que se cachee en una computadora compartida. */
  const privado = (res: Response) => res.set('Cache-Control', 'no-store')

  function conClinica(req: Request, res: Response, next: NextFunction) {
    const s = leer<Sesion>(req, COOKIE_SESION)
    if (!s?.habilitadas?.length) return res.redirect('/')
    if (!s.actual) return res.redirect('/elegir')
    res.locals.sesion = s
    privado(res)
    next()
  }

  // ── ingreso
  app.get('/', (req, res) => {
    if (leer<Sesion>(req, COOKIE_SESION)?.actual) return res.redirect('/pedidos')
    res.send(paginaIngreso())
  })

  app.post('/ingresar', async (req, res, next) => {
    try {
      const entrada = String(req.body.contacto ?? '').slice(0, 200)
      const clave = claveDeContacto(entrada)
      if (!clave) {
        return res.status(400).send(paginaIngreso(
          'No reconocemos ese formato. Escribí un celular (0981 123 456) o un correo.', entrada))
      }
      const bloqueo = codigos.admitir(clave, req.ip ?? '?')
      if (bloqueo) {
        console.warn(`[ingreso] límite ${bloqueo.ok ? '' : bloqueo.motivo} ${enmascarar(clave)} ip=${req.ip}`)
        return res.status(429).send(paginaIngreso(
          'Pediste demasiados códigos. Esperá unos minutos y probá de nuevo.', entrada))
      }

      const { clinicas, motivo } = await directorio.buscar(clave)
      let demo: string | undefined
      if (clinicas.length) {
        const r = codigos.emitir(clave, clinicas)
        if (r.ok) {
          await notificador.enviar(clave, r.codigo, clinicas)
          if (config.demo) demo = r.codigo
        }
      } else {
        console.log(`[ingreso] sin acceso ${enmascarar(clave)} (${motivo})`)
      }
      // Misma respuesta exista o no el contacto: no revelamos quién está registrado.
      const paso: PasoCodigo = { clave, ...(demo ? { demo } : {}) }
      res.cookie(COOKIE_PASO, firmar(paso, config.auth.codigoMinutos + 5),
        opcionesCookie(config.auth.codigoMinutos + 5))
      res.redirect(303, '/verificar')
    } catch (e) { next(e) }
  })

  const destinoVisible = (clave: string) => {
    const [tipo, v] = clave.split(':')
    return tipo === 'tel' ? `el celular terminado en ${v.slice(-3)}` : v
  }

  app.get('/verificar', (req, res) => {
    const paso = leer<PasoCodigo>(req, COOKIE_PASO)
    if (!paso) return res.redirect('/')
    privado(res)
    res.send(paginaCodigo({ destino: destinoVisible(paso.clave), codigoDemo: paso.demo }))
  })

  app.post('/verificar', (req, res) => {
    const paso = leer<PasoCodigo>(req, COOKIE_PASO)
    if (!paso) return res.redirect(303, '/')
    privado(res)
    const r = codigos.verificar(paso.clave, String(req.body.codigo ?? '').slice(0, 20))
    if (!r.ok) {
      const mensaje = r.motivo === 'incorrecto'
        ? 'El código no es correcto. Revisalo y probá de nuevo.'
        : 'El código venció o ya no es válido. Pedí uno nuevo.'
      return res.status(400).send(paginaCodigo({
        destino: destinoVisible(paso.clave), error: mensaje,
        codigoDemo: r.motivo === 'incorrecto' ? paso.demo : undefined,
      }))
    }
    res.clearCookie(COOKIE_PASO, { path: '/' })
    const s: Sesion = { habilitadas: r.clinicas, actual: r.clinicas.length === 1 ? r.clinicas[0] : undefined }
    guardarSesion(res, s)
    console.log(`[ingreso] ok ${enmascarar(paso.clave)} → ${r.clinicas.map((c) => c.codigo).join(',')}`)
    res.redirect(303, s.actual ? '/pedidos' : '/elegir')
  })

  app.get('/elegir', (req, res) => {
    const s = leer<Sesion>(req, COOKIE_SESION)
    if (!s?.habilitadas?.length) return res.redirect('/')
    privado(res)
    res.send(paginaElegir(s.habilitadas))
  })

  app.post('/elegir', (req, res) => {
    const s = leer<Sesion>(req, COOKIE_SESION)
    if (!s?.habilitadas?.length) return res.redirect(303, '/')
    const elegida = s.habilitadas.find((c) => c.codigo === Number(req.body.clinica))
    if (!elegida) return res.status(403).send(paginaError('Esa clínica no está asociada a tu contacto.', '/elegir'))
    guardarSesion(res, { ...s, actual: elegida })
    res.redirect(303, '/pedidos')
  })

  app.post('/salir', (_req, res) => {
    res.clearCookie(COOKIE_SESION, { path: '/' })
    res.clearCookie(COOKIE_PASO, { path: '/' })
    res.redirect(303, '/')
  })

  // ── la clínica adentro
  app.get('/pedidos', conClinica, async (req, res, next) => {
    try {
      const s = res.locals.sesion as Sesion
      const q = String(req.query.q ?? '').trim().slice(0, 80)
      const todos = await listarPedidos(db, s.actual!.codigo)
      const pedidos = q ? todos.filter((p) => coincide(p, q)) : todos
      res.send(paginaPedidos({
        clinica: s.actual!, variasClinicas: s.habilitadas.length > 1,
        pedidos, total: todos.length, q, ventana: await ventanaResultados(db),
      }))
    } catch (e) { next(e) }
  })

  app.get('/pedidos/:fecha/:nro', conClinica, async (req, res, next) => {
    try {
      const s = res.locals.sesion as Sesion
      const informe = await obtenerInforme(db, s.actual!.codigo, req.params.fecha, Number(req.params.nro))
      if (!informe) {
        // Tanto si no existe como si es de otra clínica: 404, sin distinguir.
        return res.status(404).send(paginaError('No encontramos ese pedido entre los de tu clínica.', '/pedidos'))
      }
      res.send(paginaInforme({ clinica: s.actual!, variasClinicas: s.habilitadas.length > 1, informe }))
    } catch (e) { next(e) }
  })

  app.get('/health', async (_req, res) => {
    try {
      res.json({ ok: true, driver: db.label, demo: config.demo, ...(await diagnostico(db)) })
    } catch (e) {
      res.status(500).json({ ok: false, driver: db.label, error: String(e) })
    }
  })

  app.use((_req, res) => res.status(404).send(paginaError('Esa página no existe.')))
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err)
    res.status(500).send(paginaError('Ocurrió un error inesperado. Intentá de nuevo.'))
  })

  const limpieza = setInterval(() => codigos.limpiar(), 5 * 60_000)
  limpieza.unref()

  return { app, directorio, codigos }
}

async function main() {
  const db = await openDb()
  const { app, directorio } = crearApp({ db })
  const stats = await directorio.cargar()
  app.listen(config.port, () => {
    console.log(`\n  CEDIVEP · portal de resultados para clínicas`)
    console.log(`  http://localhost:${config.port}`)
    console.log(`  datos: ${db.label}`)
    console.log(`  clínicas: ${stats.clinicas} · contactos para ingresar: ${stats.contactos}` +
      (stats.compartidos ? ` · ${stats.compartidos} contactos compartidos bloqueados` : ''))
    if (config.demo) {
      console.log(`  MODO DEMO: los códigos se muestran en pantalla.`)
      if (config.driver === 'sqlite') console.log(`  probá con el celular 0981 000 001 (Clínica Tacuary) o 0981 000 002\n`)
    }
    if (config.auth.sessionSecretIsEphemeral && !config.demo) {
      console.warn(`  ATENCIÓN: falta SESSION_SECRET; las sesiones se pierden al reiniciar.\n`)
    }
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
