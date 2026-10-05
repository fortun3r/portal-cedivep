/**
 * De punta a punta contra el demo sqlite: el servidor real, peticiones HTTP
 * reales, cookies reales. Lo importante acá es la SEGURIDAD: que una clínica
 * no pueda ver lo de otra, y que el ingreso no se pueda forzar.
 */
import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, test } from 'node:test'
import { makeSqlite } from '../src/db.js'
import type { Notificador } from '../src/notificar.js'
import { crearApp } from '../src/server.js'

/** Captura los códigos en vez de mandarlos por WhatsApp. */
const enviados: { clave: string; codigo: string }[] = []
const notificador: Notificador = {
  nombre: 'test',
  async enviar(clave, codigo) { enviados.push({ clave, codigo }) },
}
const ultimoCodigo = (clave: string) => [...enviados].reverse().find((e) => e.clave === clave)?.codigo

let base = ''

/**
 * Un servidor nuevo por grupo de tests: así los límites de intentos de un
 * grupo (que funcionan, y hay un test que lo prueba) no contaminan al otro.
 */
function conServidorPropio() {
  let cerrar = () => {}
  before(async () => {
    const { app, directorio } = crearApp({ db: makeSqlite(), notificador })
    await directorio.cargar()
    const srv = app.listen(0)
    base = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`
    cerrar = () => srv.close()
  })
  after(() => cerrar())
}

/** Un navegador mínimo: guarda cookies y no sigue redirecciones solo. */
class Navegador {
  cookies = new Map<string, string>()
  async ir(path: string, form?: Record<string, string>) {
    const r = await fetch(base + path, {
      method: form ? 'POST' : 'GET',
      redirect: 'manual',
      headers: {
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    })
    for (const c of r.headers.getSetCookie()) {
      const [par] = c.split(';')
      const i = par.indexOf('=')
      const v = par.slice(i + 1)
      if (v) this.cookies.set(par.slice(0, i), v)
      else this.cookies.delete(par.slice(0, i))
    }
    return { status: r.status, destino: r.headers.get('location'), html: await r.text() }
  }

  /** Ingreso completo con un contacto. */
  async entrar(contacto: string, clave: string) {
    await this.ir('/ingresar', { contacto })
    const codigo = ultimoCodigo(clave)
    assert.ok(codigo, `no se envió código a ${clave}`)
    return this.ir('/verificar', { codigo })
  }
}

describe('ingreso', () => {
  conServidorPropio()

  test('celular registrado → código → adentro', async () => {
    const n = new Navegador()
    const r1 = await n.ir('/ingresar', { contacto: '0981 000 001' })
    assert.equal(r1.status, 303)
    assert.equal(r1.destino, '/verificar')
    const codigo = ultimoCodigo('tel:981000001')!
    const r2 = await n.ir('/verificar', { codigo })
    assert.equal(r2.destino, '/pedidos')
    const r3 = await n.ir('/pedidos')
    assert.equal(r3.status, 200)
    assert.match(r3.html, /CLÍNICA TACUARY/)
  })

  test('el mismo celular escrito distinto también entra', async () => {
    const n = new Navegador()
    const r = await n.entrar('+595 981-000-001', 'tel:981000001')
    assert.equal(r.destino, '/pedidos')
  })

  test('por correo, aunque la clínica tenga dos correos en el mismo campo', async () => {
    const n = new Navegador()
    const r = await n.entrar('ADMIN@ejemplo.com.py', 'mail:admin@ejemplo.com.py')
    assert.equal(r.destino, '/pedidos')
  })

  test('un código usado no sirve dos veces', async () => {
    const n = new Navegador()
    await n.ir('/ingresar', { contacto: 'tacuary@ejemplo.com.py' })
    const codigo = ultimoCodigo('mail:tacuary@ejemplo.com.py')!
    assert.equal((await n.ir('/verificar', { codigo })).destino, '/pedidos')
    const otro = new Navegador()
    otro.cookies.set('cedivep_paso', n.cookies.get('cedivep_paso') ?? '')
    await otro.ir('/ingresar', { contacto: 'tacuary@ejemplo.com.py' })
    const nuevo = ultimoCodigo('mail:tacuary@ejemplo.com.py')!
    if (nuevo !== codigo) assert.equal((await otro.ir('/verificar', { codigo })).status, 400)
  })

  test('código incorrecto: 400, y a los 5 intentos se invalida', async () => {
    const n = new Navegador()
    await n.ir('/ingresar', { contacto: '0971 000 003' })
    const bueno = ultimoCodigo('tel:971000003')!
    const malo = bueno === '000000' ? '111111' : '000000'
    for (let i = 0; i < 4; i++) {
      const r = await n.ir('/verificar', { codigo: malo })
      assert.equal(r.status, 400)
      assert.match(r.html, /no es correcto/)
    }
    const quinto = await n.ir('/verificar', { codigo: malo })
    assert.match(quinto.html, /venció o ya no es válido/)
    // y ahora ni el bueno sirve
    const r = await n.ir('/verificar', { codigo: bueno })
    assert.equal(r.status, 400)
  })

  test('contacto desconocido: misma respuesta, pero no se manda nada', async () => {
    const antes = enviados.length
    const r = await new Navegador().ir('/ingresar', { contacto: '0985 999 888' })
    assert.equal(r.status, 303)
    assert.equal(r.destino, '/verificar')
    assert.equal(enviados.length, antes)
  })

  test('nadie entra como la clínica comodín 1 (particulares)', async () => {
    const antes = enviados.length
    await new Navegador().ir('/ingresar', { contacto: '0981 000 999' })
    assert.equal(enviados.length, antes)
  })

  test('una clínica dada de baja (HABILITA=N) no recibe código', async () => {
    const antes = enviados.length
    await new Navegador().ir('/ingresar', { contacto: '0981 000 009' })
    assert.equal(enviados.length, antes)
  })

  test('formato inválido → 400 con mensaje', async () => {
    const r = await new Navegador().ir('/ingresar', { contacto: 'hola' })
    assert.equal(r.status, 400)
    assert.match(r.html, /No reconocemos ese formato/)
  })

  test('límite: más de 3 códigos por contacto en 15 minutos → 429', async () => {
    const n = new Navegador()
    const estados = []
    for (let i = 0; i < 4; i++) estados.push((await n.ir('/ingresar', { contacto: '0985 111 222' })).status)
    assert.deepEqual(estados, [303, 303, 303, 429])
  })
})

describe('varias clínicas con el mismo celular', () => {
  conServidorPropio()

  test('pide elegir, y solo deja elegir entre las suyas', async () => {
    const n = new Navegador()
    const r = await n.entrar('0981 000 002', 'tel:981000002')
    assert.equal(r.destino, '/elegir')
    const pagina = await n.ir('/elegir')
    assert.match(pagina.html, /VETERINARIA SAN ROQUE/)
    assert.match(pagina.html, /AGROVET PARAGUARÍ/)

    const intruso = await n.ir('/elegir', { clinica: '2646' })   // Tacuary no es suya
    assert.equal(intruso.status, 403)

    const ok = await n.ir('/elegir', { clinica: '424' })
    assert.equal(ok.destino, '/pedidos')
    assert.match((await n.ir('/pedidos')).html, /VETERINARIA SAN ROQUE/)
  })
})

describe('autorización: cada clínica ve solo lo suyo', () => {
  conServidorPropio()

  let tacuary: Navegador
  before(async () => {
    tacuary = new Navegador()
    await tacuary.entrar('0981 000 001', 'tel:981000001')
  })

  test('ve sus informes', async () => {
    const r = await tacuary.ir('/pedidos/2026-07-24/5')
    assert.equal(r.status, 200)
    assert.match(r.html, /SHAKIRA/)
  })

  test('NO ve el pedido de otra clínica cambiando la URL', async () => {
    const r = await tacuary.ir('/pedidos/2026-07-23/12')   // es de San Roque
    assert.equal(r.status, 404)
    assert.doesNotMatch(r.html, /LOLA/)
  })

  test('NO ve el pedido de un particular', async () => {
    assert.equal((await tacuary.ir('/pedidos/2026-07-24/9')).status, 404)
  })

  test('un pedido anulado no se lista ni se puede abrir', async () => {
    const lista = await tacuary.ir('/pedidos')
    assert.doesNotMatch(lista.html, /260725\/\s*7/)
    assert.equal((await tacuary.ir('/pedidos/2026-07-25/7')).status, 404)
  })

  test('parámetros basura → 404, no error', async () => {
    for (const p of ['/pedidos/hola/5', '/pedidos/2026-07-24/-1', "/pedidos/2026-07-24/1'%20OR%201=1"]) {
      assert.equal((await tacuary.ir(p)).status, 404, p)
    }
  })

  test('una cookie de sesión manipulada no sirve', async () => {
    const falso = new Navegador()
    const [cuerpo, firma] = tacuary.cookies.get('cedivep_sesion')!.split('.')
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString())
    datos.actual = { codigo: 424, nombre: 'X' }
    datos.habilitadas = [datos.actual]
    falso.cookies.set('cedivep_sesion', `${Buffer.from(JSON.stringify(datos)).toString('base64url')}.${firma}`)
    const r = await falso.ir('/pedidos')
    assert.equal(r.status, 302)
    assert.equal(r.destino, '/')
  })

  test('sin sesión, los pedidos redirigen al ingreso', async () => {
    const r = await new Navegador().ir('/pedidos/2026-07-24/5')
    assert.equal(r.destino, '/')
  })
})

describe('listado e informe', () => {
  conServidorPropio()

  let n: Navegador
  before(async () => {
    n = new Navegador()
    await n.entrar('0981 000 001', 'tel:981000001')
  })

  test('el listado muestra los cuatro estados', async () => {
    const { html } = await n.ir('/pedidos')
    assert.match(html, /En proceso/)
    assert.match(html, /Resultados disponibles/)
    assert.match(html, /No disponible en línea/)
    assert.match(html, /Urgente/)
    assert.match(html, /Entrega prevista: 31\/07\/2026/)
  })

  test('buscar por caravana encuentra el rodeo', async () => {
    const { html } = await n.ir('/pedidos?q=151667')
    assert.match(html, /260722\/219/)
    assert.doesNotMatch(html, /SHAKIRA/)
  })

  test('buscar sin acentos encuentra con acentos', async () => {
    const { html } = await n.ir('/pedidos?q=leptospirosis')
    assert.match(html, /260722\/219/)
  })

  test('informe de SHAKIRA: secciones correctas y el R.D.W. fuera de rango', async () => {
    const { html } = await n.ir('/pedidos/2026-07-24/5')
    const secciones = [...html.matchAll(/<tr class="seccion"><td colspan="3">([^<]+)/g)].map((m) => m[1])
    assert.deepEqual(secciones, ['BIOMETRIA HEMATICA', 'LEUCOGRAMA'])
    const fuera = [...html.matchAll(/<tr class="fuera">\s*<td class="prueba">([^<]+)/g)].map((m) => m[1])
    assert.deepEqual(fuera, ['R.D.W.'])
    // El orden de impresión (las filas del demo están insertadas desordenadas)
    const pruebas = [...html.matchAll(/<td class="prueba">([^<]+)/g)].map((m) => m[1])
    assert.deepEqual(pruebas.slice(0, 3), ['Hemoglobina', 'Hematócrito', 'Glóbulos Rojos'])
  })

  test('el rodeo muestra los 4 animales, en orden, con índice', async () => {
    const { html } = await n.ir('/pedidos/2026-07-22/219')
    const animales = [...html.matchAll(/<h2 class="animal-titulo">([^<]+)/g)].map((m) => m[1].trim())
    assert.deepEqual(animales, ['154983', '151667', '126', '105'])
    assert.match(html, /<nav class="indice/)
  })

  test('las páginas con resultados no se cachean', async () => {
    const r = await fetch(`${base}/pedidos/2026-07-24/5`, {
      headers: { cookie: [...n.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
    })
    assert.equal(r.headers.get('cache-control'), 'no-store')
    assert.match(r.headers.get('content-security-policy') ?? '', /script-src 'self'/)
  })
})
