/**
 * End to end against the real app: `next start` (after `next build`) on the
 * sqlite demo, real HTTP requests, real cookies. What matters most here is
 * SECURITY: one clinic must never see another's data, and login can't be forced.
 *
 * Each describe gets its own server so the in-memory rate limits of one group
 * (20 code requests per IP, 3 per contact, per 15 min) don't leak into another.
 */
import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { createHmac } from 'node:crypto'
import { once } from 'node:events'
import { createServer, type AddressInfo } from 'node:net'
import { after, before, describe, test } from 'node:test'

const SECRET = 'e2e-only-secret-0123456789abcdef0123456789'
const ENV = {
  CEDIVEP_DRIVER: 'sqlite', CEDIVEP_DEMO: '1', SESSION_SECRET: SECRET, SESSION_HOURS: '12',
  PUBLIC_URL: 'http://portal.test', BLOCK_DELINQUENT: 'false', BLOCK_DISABLED: 'true',
  COOKIE_SECURE: 'false', TRUST_PROXY: 'false',
}

let base = ''

async function freePort(): Promise<number> {
  const s = createServer().listen(0, '127.0.0.1')
  await once(s, 'listening')
  const { port } = s.address() as AddressInfo
  s.close()
  await once(s, 'close')
  return port
}

/** A fresh `next start` for the current describe. */
function ownServer(extraEnv: Record<string, string> = {}) {
  let child: ChildProcess
  before(async () => {
    const port = await freePort()
    base = `http://127.0.0.1:${port}`
    child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'],
      { env: { ...process.env, ...ENV, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout!.on('data', (d) => { output += d })
    child.stderr!.on('data', (d) => { output += d })
    for (let i = 0; i < 150; i++) {
      try {
        if ((await fetch(`${base}/health`)).status) return   // up (a DB that is down still answers)
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error(`next start did not come up:\n${output}`)
  })
  after(async () => {
    child.kill('SIGTERM')
    if (child.exitCode === null) await once(child, 'exit')
  })
}

// ───────────────────────────────────────────── helpers

/** The HTML a person sees: no scripts (the RSC payload repeats every text) and no React comments. */
const visible = (html: string) => html.replace(/<script\b[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '')

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'" }
const text = (html: string) => visible(html).replace(/<[^>]+>/g, ' ')
  .replace(/&(amp|lt|gt|quot|#x27|#39);/g, (_, e: string) => ENTITIES[e]).replace(/\s+/g, ' ').trim()

/** Inner HTML of every `<tag class="… cls …">` (up to its first closing tag: leaf-ish elements only). */
function elements(html: string, tag: string, cls?: string): string[] {
  const klass = cls ? `[^>]*\\bclass="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"` : ''
  const re = new RegExp(`<${tag}\\b${klass}[^>]*>([\\s\\S]*?)</${tag}>`, 'g')
  return [...visible(html).matchAll(re)].map((m) => m[1])
}

/** Signs like src/lib/auth.ts `sign()`, with the test server's secret. */
function signForTest(data: object, minutes: number): string {
  const body = Buffer.from(JSON.stringify({ ...data, exp: Date.now() + minutes * 60_000 })).toString('base64url')
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`
}

/** Order references in list order, spaces removed ('260724/  5' → '260724/5'). */
const refs = (html: string) => elements(html, 'span', 'ref').map((r) => text(r).replace(/\s+/g, ''))

/** Filter chips → their counts: { Todos: 6, Disponibles: 4, … }. */
const filters = (html: string) => Object.fromEntries(elements(html, 'a', 'filtro')
  .map((a) => [text(a).replace(/\s*\d+$/, ''), Number(/(\d+)$/.exec(text(a))![1])]))

/** References of the orders marked NUEVO. */
const news = (html: string) => elements(html, 'a', 'pedido')
  .filter((a) => /class="etiqueta-nuevo"/.test(a))
  .map((a) => text(elements(a, 'span', 'ref')[0]).replace(/\s+/g, ''))

const payload = (cookie: string) => JSON.parse(Buffer.from(cookie.split('.')[0], 'base64url').toString())

/** A minimal browser: keeps cookies and doesn't follow redirects by itself. */
class Browser {
  cookies = new Map<string, string>()

  async go(path: string, form?: Record<string, string>) {
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
      const [pair, ...attrs] = c.split(';').map((s) => s.trim())
      const i = pair.indexOf('=')
      const [name, value] = [pair.slice(0, i), pair.slice(i + 1)]
      const gone = attrs.some((a) => /^max-age=(0|-)/i.test(a)
        || (/^expires=/i.test(a) && Date.parse(a.slice(8)) < Date.now()))
      if (!value || gone) this.cookies.delete(name)
      else this.cookies.set(name, value)
    }
    return { status: r.status, location: r.headers.get('location'), headers: r.headers, html: await r.text() }
  }

  /** The code shown in demo mode on /verificar, or null if none is shown. */
  async demoCode() {
    const { html } = await this.go('/verificar')
    const m = /class="demo"[\s\S]*?<strong>(\d{3}) (\d{3})<\/strong>/.exec(visible(html))
    return m ? m[1] + m[2] : null
  }

  async login(contact: string, returnTo?: string) {
    const r = await this.go('/api/login', { contact, ...(returnTo ? { returnTo } : {}) })
    assert.equal(r.location, '/verificar')
    const code = await this.demoCode()
    assert.ok(code, `no code shown for ${contact}`)
    return this.go('/api/verify', { code })
  }
}

const volver = (path: string) => `?${new URLSearchParams({ volver: path })}`

// ───────────────────────────────────────────── login

describe('login', () => {
  ownServer()

  test('registered phone → code → in', async () => {
    const b = new Browser()
    const r1 = await b.go('/api/login', { contact: '0981 000 001' })
    assert.equal(r1.status, 303)
    assert.equal(r1.location, '/verificar')
    const code = await b.demoCode()
    const r2 = await b.go('/api/verify', { code: code! })
    assert.equal(r2.status, 303)
    assert.equal(r2.location, '/pedidos')
    const cookie = r2.headers.getSetCookie().find((c) => c.startsWith('cedivep_session='))!
    assert.match(cookie, /Max-Age=43200(;|$)/)    // 12 h in SECONDS
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=lax/i)
    const r3 = await b.go('/pedidos')
    assert.equal(r3.status, 200)
    assert.match(text(r3.html), /CLÍNICA TACUARY/)
  })

  test('the same phone written differently also gets in', async () => {
    assert.equal((await new Browser().login('+595 981-000-001')).location, '/pedidos')
  })

  test('by email, even when the clinic has two emails in the same field', async () => {
    assert.equal((await new Browser().login('ADMIN@ejemplo.com.py')).location, '/pedidos')
  })

  test('a code works only once (replaying the step cookie)', async () => {
    const b = new Browser()
    await b.go('/api/login', { contact: 'tacuary@ejemplo.com.py' })
    const step = b.cookies.get('cedivep_step')!
    const code = (await b.demoCode())!
    assert.equal((await b.go('/api/verify', { code })).location, '/pedidos')

    const replay = new Browser()
    replay.cookies.set('cedivep_step', step)
    const r = await replay.go('/api/verify', { code })
    assert.equal(r.location, '/verificar?error=vencido')
    assert.ok(!replay.cookies.has('cedivep_session'))
  })

  test('wrong code: an error each time, and after 5 attempts even the right one fails', async () => {
    const b = new Browser()
    await b.go('/api/login', { contact: '0971 000 003' })
    const good = (await b.demoCode())!
    const bad = good === '000000' ? '111111' : '000000'
    for (let i = 0; i < 4; i++) {
      assert.equal((await b.go('/api/verify', { code: bad })).location, '/verificar?error=incorrecto')
    }
    const page = await b.go('/verificar?error=incorrecto')
    assert.match(text(page.html), /El código no es correcto\. Revisalo y probá de nuevo\./)
    assert.ok(await b.demoCode(), 'the demo code is still shown after a wrong attempt')

    assert.equal((await b.go('/api/verify', { code: bad })).location, '/verificar?error=vencido')
    assert.match(text((await b.go('/verificar?error=vencido')).html), /El código venció o ya no es válido\. Pedí uno nuevo\./)
    assert.equal(await b.demoCode(), null, 'the dead code is no longer shown')
    assert.equal((await b.go('/api/verify', { code: good })).location, '/verificar?error=vencido')
    assert.ok(!b.cookies.has('cedivep_session'))
  })

  test('unknown contact: same answer, but no code is shown or sent', async () => {
    const b = new Browser()
    const r = await b.go('/api/login', { contact: '0985 999 888' })
    assert.equal(r.status, 303)
    assert.equal(r.location, '/verificar')
    const page = await b.go('/verificar')
    assert.equal(page.status, 200)
    assert.match(text(page.html), /el celular terminado en 888/)
    assert.equal(await b.demoCode(), null)
    assert.equal(payload(b.cookies.get('cedivep_step')!).demo, undefined)
  })

  test('nobody gets in as the wildcard clinic 1 (private owners)', async () => {
    const b = new Browser()
    await b.go('/api/login', { contact: '0981 000 999' })
    assert.equal(await b.demoCode(), null)
    assert.equal((await b.go('/api/verify', { code: '000000' })).location, '/verificar?error=incorrecto')
  })

  test('a deactivated clinic (HABILITA=N) gets no code', async () => {
    const b = new Browser()
    await b.go('/api/login', { contact: '0981 000 009' })
    assert.equal(await b.demoCode(), null)
  })

  test('a wrong code gets the same answer whether or not the contact exists', async () => {
    const unknown = new Browser()
    await unknown.go('/api/login', { contact: '0985 999 777' })
    const known = new Browser()
    await known.go('/api/login', { contact: '0981 000 002' })
    const a = await unknown.go('/api/verify', { code: '000001' })
    const b = await known.go('/api/verify', { code: (await known.demoCode()) === '000001' ? '000002' : '000001' })
    assert.equal(a.location, '/verificar?error=incorrecto')
    assert.equal(a.location, b.location)
  })

  test('invalid format → back to the form with the message and the typed value', async () => {
    const b = new Browser()
    const r = await b.go('/api/login', { contact: 'hola' })
    assert.equal(r.status, 303)
    assert.equal(r.location, '/?error=formato')
    const page = await b.go(r.location!)
    assert.match(text(page.html), /No reconocemos ese formato\. Escribí un celular \(0981 123 456\) o un correo\./)
    assert.match(visible(page.html), /name="contact"[^>]*value="hola"/)
  })

  test('limit: a 4th code for the same contact within 15 minutes is refused', async () => {
    const b = new Browser()
    const locations = []
    for (let i = 0; i < 4; i++) locations.push((await b.go('/api/login', { contact: '0985 111 222' })).location)
    assert.deepEqual(locations, ['/verificar', '/verificar', '/verificar', '/?error=limite'])
    assert.match(text((await b.go('/?error=limite')).html), /Pediste demasiados códigos\. Esperá unos minutos y probá de nuevo\./)
  })

  test('bodies over 2 KB or with the wrong content type are refused', async () => {
    const big = await fetch(`${base}/api/login`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `contact=${'1'.repeat(3000)}`, redirect: 'manual',
    })
    assert.equal(big.status, 413)
    const json = await fetch(`${base}/api/login`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"contact":"0981000001"}', redirect: 'manual',
    })
    assert.equal(json.status, 400)
  })
})

// ───────────────────────────────────────────── several clinics

describe('a phone shared by several clinics', () => {
  ownServer()

  let b: Browser
  before(async () => {
    b = new Browser()
    assert.equal((await b.login('0981 000 002')).location, '/elegir')
  })

  test('asks to choose, and only among its own clinics', async () => {
    const page = text((await b.go('/elegir')).html)
    assert.match(page, /VETERINARIA SAN ROQUE/)
    assert.match(page, /AGROVET PARAGUARÍ/)

    const intruder = await b.go('/api/choose-clinic', { clinic: '2646' })   // Tacuary isn't theirs
    assert.equal(intruder.status, 403)

    const exp = payload(b.cookies.get('cedivep_session')!).exp
    const ok = await b.go('/api/choose-clinic', { clinic: '424' })
    assert.equal(ok.location, '/pedidos')
    assert.ok(payload(b.cookies.get('cedivep_session')!).exp <= exp + 1000, 'switching clinics does not extend the session')
    const list = await b.go('/pedidos')
    assert.match(text(list.html), /VETERINARIA SAN ROQUE/)
    assert.equal(elements(list.html, 'a', 'barra-cambiar').length, 1)
    // Its oldest listed day has results: the list's date bound must keep that day.
    assert.deepEqual(filters(list.html), { Todos: 2, Disponibles: 2, 'En proceso': 0, 'No en línea': 0 })
  })

  test('a report without findings says everything is within range', async () => {
    const { html } = await b.go('/pedidos/2026-07-23/12')
    assert.match(text(elements(html, 'div', 'todo-ok').join('')), /Todos los valores dentro del rango de referencia/)
    assert.equal(elements(html, 'section', 'resumen').length, 0)
    assert.equal(elements(html, 'p', 'leyenda').length, 0)
  })

  test('animals with different tests: one section per animal, with an index', async () => {
    const { html } = await b.go('/pedidos/2026-07-23/13')
    assert.equal(elements(html, 'nav', 'indice').length, 1)
    assert.deepEqual(elements(html, 'h2', 'animal-titulo').map((h) => text(h).split(' ')[0]), ['TOBY', 'LUNA', 'MAX', 'NALA'])
    assert.equal(elements(html, 'table', 'matriz').length, 0)
    assert.equal(elements(html, 'table', 'resultados').length, 4)
    assert.doesNotMatch(visible(html), /<td class="rango"><span class="rango-etiqueta">REF\.<\/span><\/td>/)
  })

  test('an order key shared by two clinics is shown to neither', async () => {
    assert.doesNotMatch(text((await b.go('/pedidos')).html), /COMPARTIDO|260723\/\s*30/)
    assert.equal((await b.go('/pedidos/2026-07-23/30')).status, 404)
  })
})

// ───────────────────────────────────────────── authorization

describe('authorization: each clinic sees only its own', () => {
  ownServer()

  let tacuary: Browser
  before(async () => {
    tacuary = new Browser()
    await tacuary.login('0981 000 001')
  })

  test('sees its reports', async () => {
    const r = await tacuary.go('/pedidos/2026-07-24/5')
    assert.equal(r.status, 200)
    assert.match(text(r.html), /SHAKIRA/)
  })

  test("does NOT see another clinic's order by changing the URL", async () => {
    const r = await tacuary.go('/pedidos/2026-07-23/12')   // it's San Roque's
    assert.equal(r.status, 404)
    assert.doesNotMatch(r.html, /LOLA/)
    // Next renders a page's not-found UI from the RSC payload (the HTML shell is empty), so check the raw response.
    assert.match(r.html, /No encontramos ese pedido entre los de tu clínica/)
  })

  test("does NOT see a private owner's order", async () => {
    assert.equal((await tacuary.go('/pedidos/2026-07-24/9')).status, 404)
  })

  test('a cancelled order is neither listed nor reachable', async () => {
    assert.doesNotMatch(text((await tacuary.go('/pedidos')).html), /260725\/\s*7/)
    assert.equal((await tacuary.go('/pedidos/2026-07-25/7')).status, 404)
  })

  test('the order key shared with another clinic is 404 here too', async () => {
    assert.equal((await tacuary.go('/pedidos/2026-07-23/30')).status, 404)
  })

  test('junk parameters → 404, not an error', async () => {
    for (const p of ['/pedidos/hola/5', '/pedidos/2026-07-24/-1', "/pedidos/2026-07-24/1'%20OR%201=1",
      '/pedidos/2026-07-24/1e1', '/pedidos/2026-13-45/5', '/pedidos/2026-07-24/05']) {
      assert.equal((await tacuary.go(p)).status, 404, p)
    }
  })

  test('a tampered session cookie is worthless', async () => {
    const [body, signature] = tacuary.cookies.get('cedivep_session')!.split('.')
    const data = JSON.parse(Buffer.from(body, 'base64url').toString())
    data.currentClinic = { code: 424, name: 'X' }
    data.allowedClinics = [data.currentClinic]
    const forged = new Browser()
    forged.cookies.set('cedivep_session', `${Buffer.from(JSON.stringify(data)).toString('base64url')}.${signature}`)
    const r = await forged.go('/pedidos')
    assert.equal(r.status, 307)
    assert.equal(r.location, '/')
  })

  test('even a validly signed session cannot sit on a wildcard or an unlisted clinic', async () => {
    const wildcard = new Browser()
    wildcard.cookies.set('cedivep_session',
      signForTest({ allowedClinics: [{ code: 1, name: 'PARTICULAR' }], currentClinic: { code: 1, name: 'PARTICULAR' } }, 60))
    assert.equal((await wildcard.go('/pedidos')).location, '/')
    const unlisted = new Browser()
    unlisted.cookies.set('cedivep_session',
      signForTest({ allowedClinics: [{ code: 2646, name: 'T' }], currentClinic: { code: 424, name: 'S' } }, 60))
    assert.equal((await unlisted.go('/pedidos/2026-07-23/12')).location, '/')
  })

  test('without a session, a report sends you to log in and come back', async () => {
    const r = await new Browser().go('/pedidos/2026-07-24/5')
    assert.equal(r.status, 307)
    assert.equal(r.location, `/${volver('/pedidos/2026-07-24/5')}`)
  })

  test('logging out clears the session', async () => {
    const b = new Browser()
    b.cookies.set('cedivep_session', tacuary.cookies.get('cedivep_session')!)
    const r = await b.go('/api/logout', {})
    assert.equal(r.location, '/')
    assert.ok(!b.cookies.has('cedivep_session'))
    assert.equal((await b.go('/pedidos')).status, 307)
  })
})

// ───────────────────────────────────────────── list and report

describe('list and report', () => {
  ownServer()

  let b: Browser
  before(async () => {
    b = new Browser()
    await b.login('0981 000 001')
  })

  const activeFilter = (html: string) =>
    [...visible(html).matchAll(/<a\b[^>]*class="filtro"[^>]*aria-current="true"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => text(m[1]))

  test('when logged in, / goes to the list', async () => {
    const r = await b.go('/')
    assert.equal(r.status, 307)
    assert.equal(r.location, '/pedidos')
  })

  test('the list shows every status', async () => {
    const list = elements((await b.go('/pedidos')).html, 'ul', 'pedidos').join('')
    assert.match(list, /class="estado estado--proceso"/)
    assert.match(list, /class="estado estado--ok"/)
    assert.match(text(list), /En proceso/)
    assert.match(text(list), /Resultados disponibles/)
    assert.match(text(list), /No disponible en línea/)
    assert.match(list, /class="etiqueta-urgente">URGENTE</)
    assert.match(text(list), /Entrega prevista: 31\/07\/2026/)
  })

  test('grouped by date, newest first', async () => {
    const { html } = await b.go('/pedidos')
    assert.deepEqual(elements(html, 'h2', 'grupo-titulo').map((h) => text(h)),
      ['Martes 28 de julio 28/07/2026', 'Viernes 24 de julio 24/07/2026', 'Miércoles 22 de julio 22/07/2026',
        'Viernes 10 de julio 10/07/2026'])
    assert.deepEqual(refs(html), ['260728/40', '260724/5', '260724/2', '260722/220', '260722/219', '260710/3'])
    assert.deepEqual(elements(html, 'nav', 'paginas'), [])
    assert.doesNotMatch(text(html), /Se muestran los/)
    const missing = text((await b.go('/pedidos?q=zzz')).html)
    assert.match(missing, /Ningún pedido coincide/)
    assert.doesNotMatch(missing, /Solo se buscan/)
  })

  test('searching a tag finds the herd', async () => {
    const { html } = await b.go('/pedidos?q=151667')
    assert.deepEqual(refs(html), ['260722/220', '260722/219'])
    assert.doesNotMatch(text(html), /SHAKIRA/)
  })

  test('searching without accents finds accented data, and the reverse', async () => {
    assert.ok(refs((await b.go('/pedidos?q=leptospirosis')).html).includes('260722/219'))
    assert.ok(refs((await b.go(`/pedidos?q=${encodeURIComponent('BIOMETRÍA')}`)).html).includes('260724/5'))
  })

  test('?estado= filters, and the counts are of the whole (searched) list', async () => {
    const { html } = await b.go('/pedidos?estado=en_proceso')
    assert.deepEqual(refs(html), ['260728/40'])
    assert.deepEqual(filters(html), { Todos: 6, Disponibles: 4, 'En proceso': 1, 'No en línea': 1 })
    assert.deepEqual(activeFilter(html), ['En proceso 1'])
  })

  test('filter counts are taken after the search, and the filter links keep it', async () => {
    const { html } = await b.go('/pedidos?q=151667')
    assert.deepEqual(filters(html), { Todos: 2, Disponibles: 2, 'En proceso': 0, 'No en línea': 0 })
    for (const a of visible(html).matchAll(/<a\b[^>]*class="filtro"[^>]*href="([^"]+)"/g)) {
      assert.match(a[1].replace(/&amp;/g, '&'), /[?&]q=151667/)
    }
  })

  test('an unknown ?estado= shows everything', async () => {
    for (const e of ['xyz', '__proto__', 'constructor', 'DISPONIBLE']) {
      const { html } = await b.go(`/pedidos?estado=${e}`)
      assert.equal(refs(html).length, 6, e)
      assert.deepEqual(activeFilter(html), ['Todos 6'], e)
    }
  })

  test("SHAKIRA's report: one table, its sections, R.D.W. out of range, print order", async () => {
    const { html } = await b.go('/pedidos/2026-07-24/5')
    const tables = elements(html, 'table', 'resultados')
    assert.equal(tables.length, 1)
    const t = tables[0]
    assert.deepEqual([...t.matchAll(/<th\b[^>]*class="seccion"[^>]*>([^<]*)<\/th>/gi)].map((m) => m[1]),
      ['BIOMETRIA HEMATICA', 'LEUCOGRAMA'])
    const rows = elements(t, 'tr').filter((tr) => /class="prueba"/.test(tr))
    const name = (tr: string) => text(elements(tr, 'td', 'prueba')[0])
    assert.deepEqual(rows.filter((tr) => /class="marcador"/.test(tr)).map(name), ['R.D.W.'])
    assert.match(text(rows.find((tr) => name(tr) === 'R.D.W.')!), /▲ 22,5 %/)
    // The demo rows are stored shuffled: the order comes from UBICACION.
    assert.deepEqual(rows.slice(0, 3).map(name), ['Hemoglobina', 'Hematócrito', 'Glóbulos Rojos'])
  })

  test('findings summary for one animal', async () => {
    const { html } = await b.go('/pedidos/2026-07-24/5')
    const summary = text(elements(html, 'section', 'resumen').join(''))
    assert.match(summary, /1 valor fuera de rango/)
    assert.match(summary, /R\.D\.W\. ▲ 22,5 % ref\. 17,0 - 20,0 %/)
    assert.equal(elements(html, 'p', 'leyenda').length, 1)
  })

  test('a herd of 4 with the same tests is a matrix, in order, without the index', async () => {
    const { html } = await b.go('/pedidos/2026-07-22/219')
    const [m] = elements(html, 'table', 'matriz')
    assert.deepEqual([...m.matchAll(/<th\b[^>]*scope="row"[^>]*>([^<]*)<\/th>/g)].map((x) => x[1]),
      ['154983', '151667', '126', '105'])
    assert.deepEqual(elements(m, 'tr').slice(2).map((tr) => /class="marcador"/.test(tr)), [false, true, false, false])
    assert.match(m, /<th\b[^>]*class="grupo-col"[^>]*colspan="3"[^>]*>LEPTOSPIROSIS</i)
    assert.equal(elements(html, 'nav', 'indice').length, 0)
    assert.equal(elements(html, 'h2', 'animal-titulo').length, 0)
    assert.match(text(elements(html, 'div', 'matriz-pie').join('')), /^4 animales/)
    assert.match(text(elements(html, 'dl', 'datos').join('')), /Animales 4/)
  })

  test('?hallazgos=1 filters the matrix rows; the summary and counts stay whole', async () => {
    const { html } = await b.go('/pedidos/2026-07-22/219?hallazgos=1')
    const [m] = elements(html, 'table', 'matriz')
    assert.deepEqual([...m.matchAll(/scope="row"[^>]*>([^<]*)</g)].map((x) => x[1]), ['151667'])
    assert.match(text(elements(html, 'div', 'matriz-pie').join('')), /1 de 4 animales · solo con hallazgos/)
    const sw = /<a\b[^>]*class="interruptor"[^>]*>[\s\S]*?<\/a>/.exec(visible(html))![0]
    assert.match(sw, /aria-checked="true"/)
    assert.match(sw, /href="\/pedidos\/2026-07-22\/219"/)
    assert.match(text(sw), /Solo animales con hallazgos \(1\)/)
    const summary = text(elements(html, 'section', 'resumen').join(''))
    assert.match(summary, /1 valor fuera de rango/)
    assert.match(summary, /151667 LEPTOSPIROSIS · Hardjo ▲ 1\/400/)
    const profile = text(elements(html, 'dl', 'ficha').join(''))
    assert.match(profile, /NELORE/)
    assert.match(profile, /Hembra/)
    assert.match(profile, /2\.00 Años/)
    assert.doesNotMatch(profile, /Especie/i)
  })

  test('the findings switch is off by default and with any other value', async () => {
    for (const q of ['', '?hallazgos=0', '?hallazgos=true']) {
      const { html } = await b.go(`/pedidos/2026-07-22/219${q}`)
      assert.equal([...elements(html, 'table', 'matriz')[0].matchAll(/scope="row"/g)].length, 4, q)
      const sw = /<a\b[^>]*class="interruptor"[^>]*>/.exec(visible(html))![0]
      assert.match(sw, /aria-checked="false"/)
      assert.match(sw, /href="\/pedidos\/2026-07-22\/219\?hallazgos=1"/)
    }
  })

  test('the WhatsApp message has the reference, animal and analysis, never values', async () => {
    const { html } = await b.go('/pedidos/2026-07-24/5')
    const href = /<a\b[^>]*class="boton-borde"[^>]*href="(https:\/\/wa\.me\/\?text=[^"]+)"/.exec(visible(html))![1]
    const msg = decodeURIComponent(new URL(href.replace(/&amp;/g, '&')).searchParams.get('text')!)
    assert.equal(msg, 'Resultados CEDIVEP · Ref. 260724/5 · SHAKIRA (BIOMETRIA HEMATICA)\nhttp://portal.test/pedidos/2026-07-24/5')
  })

  test('an order still in progress opens without results or a share link', async () => {
    const { status, html } = await b.go('/pedidos/2026-07-28/40')
    assert.equal(status, 200)
    assert.match(text(html), /Este pedido todavía no tiene resultados cargados\./)
    assert.doesNotMatch(html, /wa\.me/)
  })

  test('authenticated pages are private, no-store', async () => {
    const isPrivate = (h: Headers, p: string) => {
      const cc = h.get('cache-control') ?? ''
      assert.match(cc, /\bprivate\b/, p)
      assert.match(cc, /\bno-store\b/, p)
    }
    for (const p of ['/pedidos', '/pedidos?estado=disponible', '/pedidos?pagina=2', '/pedidos/2026-07-24/5',
      '/pedidos/2026-07-22/219?hallazgos=1', '/elegir', '/pedidos/2026-07-23/12']) {
      isPrivate((await b.go(p)).headers, p)
    }
    const step = new Browser()
    await step.go('/api/login', { contact: '0985 999 888' })
    const verify = await step.go('/verificar')
    assert.equal(verify.status, 200)
    isPrivate(verify.headers, '/verificar')
  })

  test('security headers: nonce-based CSP on every script, no framing, no X-Powered-By', async () => {
    const { headers, html } = await b.go('/pedidos/2026-07-24/5')
    const csp = headers.get('content-security-policy') ?? ''
    const nonce = /script-src[^;]*'nonce-([^']+)'/.exec(csp)?.[1]
    assert.ok(nonce, csp)
    assert.doesNotMatch(/script-src[^;]*/.exec(csp)![0], /unsafe-inline/)
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((m) => m[0])
    assert.ok(scripts.length > 0)
    for (const s of scripts) assert.match(s, new RegExp(`nonce="${nonce}"`), s)
    assert.equal(headers.get('x-frame-options'), 'DENY')
    assert.equal(headers.get('x-content-type-options'), 'nosniff')
    assert.equal(headers.get('x-powered-by'), null)
    assert.doesNotMatch(visible(html), /\sstyle="/)
  })
})

// ───────────────────────────────────────────── coming back to a shared report

describe('back to the report after logging in (?volver=)', () => {
  ownServer()

  test('the login page carries a valid volver into the form', async () => {
    const { html } = await new Browser().go(`/${volver('/pedidos/2026-07-24/5')}`)
    assert.match(visible(html), /name="returnTo" value="\/pedidos\/2026-07-24\/5"/)
  })

  test('after logging in you land on the report', async () => {
    const b = new Browser()
    const r = await b.login('0981 000 001', '/pedidos/2026-07-24/5')
    assert.equal(r.location, '/pedidos/2026-07-24/5')
    assert.match(text((await b.go(r.location!)).html), /SHAKIRA/)
  })

  test('"Usar otro celular o correo" keeps it too', async () => {
    const b = new Browser()
    await b.go('/api/login', { contact: '0985 999 111', returnTo: '/pedidos/2026-07-24/5' })
    assert.match(visible((await b.go('/verificar')).html),
      /class="acceso-volver" href="\/\?volver=%2Fpedidos%2F2026-07-24%2F5"/)
  })

  test('it survives a typo in the contact', async () => {
    const r = await new Browser().go('/api/login', { contact: 'hola', returnTo: '/pedidos/2026-07-24/5' })
    assert.equal(r.location, `/?error=formato&${volver('/pedidos/2026-07-24/5').slice(1)}`)
  })

  test('with several clinics it survives the clinic picker', async () => {
    const b = new Browser()
    const r = await b.login('0981 000 002', '/pedidos/2026-07-23/12')
    assert.equal(r.location, `/elegir${volver('/pedidos/2026-07-23/12')}`)
    assert.match(visible((await b.go(r.location!)).html), /name="returnTo" value="\/pedidos\/2026-07-23\/12"/)
    const chosen = await b.go('/api/choose-clinic', { clinic: '424', returnTo: '/pedidos/2026-07-23/12' })
    assert.equal(chosen.location, '/pedidos/2026-07-23/12')
    assert.match(text((await b.go(chosen.location!)).html), /LOLA/)
  })

  test('external or odd values are ignored', async () => {
    for (const v of ['//evil.com', '/\\evil.com', 'https://evil.com', '/pedidos/../elegir', '/pedidos/%2e%2e/x',
      '%2Fpedidos%2F2026-07-24%2F5', '/pedidos/2026-07-24/5\r\nSet-Cookie: x=1', 'javascript:alert(1)']) {
      const { html } = await new Browser().go(`/${volver(v)}`)
      assert.doesNotMatch(visible(html), /name="returnTo"/, v)
      assert.doesNotMatch(visible(html), /evil/, v)
    }
    const b = new Browser()
    assert.equal((await b.login('0981 000 001', '//evil.com')).location, '/pedidos')
  })

  test('already logged in, / follows a valid volver and ignores a bad one', async () => {
    const b = new Browser()
    await b.login('tacuary@ejemplo.com.py')
    assert.equal((await b.go(`/${volver('/pedidos/2026-07-24/2')}`)).location, '/pedidos/2026-07-24/2')
    assert.equal((await b.go(`/${volver('//evil.com')}`)).location, '/pedidos')
  })
})

// ───────────────────────────────────────────── resend

describe('resend code', () => {
  ownServer()

  test("uses the contact from the step cookie, not the form's", async () => {
    const b = new Browser()
    await b.go('/api/login', { contact: 'sanroque@ejemplo.com.py' })
    const first = (await b.demoCode())!
    const r = await b.go('/api/login', { resend: '1', contact: '0981 000 001' })
    assert.equal(r.location, '/verificar')
    assert.equal(payload(b.cookies.get('cedivep_step')!).key, 'mail:sanroque@ejemplo.com.py')
    assert.match(text((await b.go('/verificar')).html), /el correo s•••@ejemplo\.com\.py/)
    const second = (await b.demoCode())!
    if (second !== first) assert.equal((await b.go('/api/verify', { code: first })).location, '/verificar?error=incorrecto')
    assert.equal((await b.go('/api/verify', { code: second })).location, '/pedidos')
  })

  test('the 4th code in 15 minutes, resends included, is refused', async () => {
    const b = new Browser()
    const locations = [(await b.go('/api/login', { contact: 'admin@ejemplo.com.py' })).location]
    for (let i = 0; i < 2; i++) locations.push((await b.go('/api/login', { resend: '1' })).location)
    const last = (await b.demoCode())!
    locations.push((await b.go('/api/login', { resend: '1' })).location)
    assert.deepEqual(locations, ['/verificar', '/verificar', '/verificar', '/verificar?error=limite'])
    assert.match(text((await b.go('/verificar?error=limite')).html), /Pediste demasiados códigos/)
    assert.equal((await b.go('/api/verify', { code: last })).location, '/pedidos')
  })

  test('without a step cookie, back to the start', async () => {
    assert.equal((await new Browser().go('/api/login', { resend: '1', contact: '0981 000 001' })).location, '/')
  })
})

// ───────────────────────────────────────────── "nuevo"

describe('new since your last visit', () => {
  ownServer()

  let session = ''
  before(async () => {
    const b = new Browser()
    await b.login('tacuary@ejemplo.com.py')
    session = b.cookies.get('cedivep_session')!
  })

  test('the first visit marks nothing and stores the visit', async () => {
    const b = new Browser()
    b.cookies.set('cedivep_session', session)
    const r = await b.go('/pedidos')
    assert.deepEqual(news(r.html), [])
    assert.doesNotMatch(visible(r.html), /class="pagina-nuevos"/)
    const cookie = r.headers.getSetCookie().find((c) => c.startsWith('cedivep_visit='))
    assert.ok(cookie)
    assert.match(cookie!, /HttpOnly/i)
  })

  test('after a previous visit, later available orders are new, all day long', async () => {
    const b = new Browser()
    b.cookies.set('cedivep_session', session)
    b.cookies.set('cedivep_visit', signForTest({ visits: { 2646: ['', '2026-07-23'] } }, 60))
    for (const path of ['/pedidos', '/pedidos', '/pedidos?estado=disponible']) {
      const { html } = await b.go(path)
      assert.deepEqual(news(html), ['260724/5', '260724/2'], path)
      assert.match(text(elements(html, 'div', 'pagina-meta').join('')), /2 pedidos nuevos desde tu última visita/)
      assert.match(visible(html), /<a\b[^>]*class="pagina-nuevos"[^>]*href="\/pedidos\?estado=disponible"|<a\b[^>]*href="\/pedidos\?estado=disponible"[^>]*class="pagina-nuevos"/)
    }
  })

  test('a tampered visit cookie is ignored and replaced', async () => {
    const b = new Browser()
    b.cookies.set('cedivep_session', session)
    const forged = Buffer.from(JSON.stringify({ visits: { 2646: ['', '2026-07-01'] }, exp: Date.now() + 1e9 })).toString('base64url')
    b.cookies.set('cedivep_visit', `${forged}.bad`)
    const r = await b.go('/pedidos')
    assert.deepEqual(news(r.html), [])
    assert.ok(r.headers.getSetCookie().some((c) => c.startsWith('cedivep_visit=')))
  })
})

// ───────────────────────────────────────────── paging

describe('paging a long list', () => {
  ownServer()

  // Clinic 3100 (fixture): 501 orders, 18 a day from 07-28 down to 07-01, numbered 2000 down to 1500.
  let b: Browser
  before(async () => {
    b = new Browser()
    await b.login('0981 000 004')
  })

  const pager = (html: string) => text(elements(html, 'nav', 'paginas').join(''))
  /** href of the pager link with that rel, decoded, or null. */
  const relHref = (html: string, rel: 'prev' | 'next') => {
    const tag = new RegExp(`<a\\b[^>]*\\brel="${rel}"[^>]*>`).exec(visible(html))?.[0]
    return tag ? /href="([^"]*)"/.exec(tag)![1].replace(/&amp;/g, '&') : null
  }
  const params = (href: string | null) => Object.fromEntries(new URL(href!, base).searchParams)
  const CAP = /Se muestran los 500 pedidos más recientes/

  test('the first page: 50 orders, counts of the whole list, a link to the next page', async () => {
    const { html } = await b.go('/pedidos')
    const r = refs(html)
    assert.equal(r.length, 50)
    assert.equal(r[0], '260728/2000')
    assert.equal(r[49], '260726/1951')
    assert.deepEqual(filters(html), { Todos: 500, Disponibles: 5, 'En proceso': 121, 'No en línea': 374 })
    assert.match(pager(html), /1–50 de 500/)
    assert.equal(relHref(html, 'prev'), null)
    assert.equal(relHref(html, 'next'), '/pedidos?pagina=2')
    assert.doesNotMatch(text(html), CAP)
  })

  test('the second page follows the first and links both ways', async () => {
    const first = refs((await b.go('/pedidos')).html)
    const { html } = await b.go('/pedidos?pagina=2')
    const r = refs(html)
    assert.equal(r.length, 50)
    assert.equal(r[0], '260726/1950')
    assert.ok(r.every((x) => !first.includes(x)))
    for (const n of [1928, 1927, 1926, 1925, 1924]) assert.ok(r.includes(`260724/${n}`), String(n))
    assert.match(pager(html), /51–100 de 500/)
    assert.equal(relHref(html, 'prev'), '/pedidos')
    assert.equal(relHref(html, 'next'), '/pedidos?pagina=3')
  })

  test('the last page says the list stops at the 500 newest; past the end shows the last page', async () => {
    const { html } = await b.go('/pedidos?pagina=10')
    assert.equal(refs(html).at(-1), '260701/1501')
    assert.equal(relHref(html, 'next'), null)
    assert.match(text(html), CAP)
    assert.deepEqual(refs((await b.go('/pedidos?pagina=999')).html), refs(html))
    const missing = text((await b.go('/pedidos?q=260701/1500')).html)
    assert.match(missing, /Ningún pedido coincide/)
    assert.match(missing, /Solo se buscan los 500 pedidos más recientes/)
  })

  test('a bad ?pagina= shows the first page', async () => {
    const first = refs((await b.go('/pedidos')).html)
    for (const v of ['abc', '0', '-1', '2.5', '__proto__', '%20%202']) {
      assert.deepEqual(refs((await b.go(`/pedidos?pagina=${v}`)).html), first, v)
    }
  })

  test('search covers the whole list, not just the page on screen', async () => {
    const { html } = await b.go('/pedidos?q=T1926')
    assert.deepEqual(refs(html), ['260724/1926'])
    assert.deepEqual(elements(html, 'nav', 'paginas'), [])
    assert.doesNotMatch(text(html), CAP)
  })

  test('search + filter + page: the pager keeps both; chips, search and × go back to page 1', async () => {
    const { html } = await b.go('/pedidos?q=07/2026&estado=fuera_de_ventana&pagina=2')
    assert.match(pager(html), /51–100 de 374/)
    assert.equal(refs(html)[0], '260719/1824')
    assert.deepEqual(params(relHref(html, 'prev')), { estado: 'fuera_de_ventana', q: '07/2026' })
    assert.deepEqual(params(relHref(html, 'next')), { estado: 'fuera_de_ventana', q: '07/2026', pagina: '3' })
    const hrefs = [...visible(html).matchAll(/<a\b[^>]*class="(?:filtro|buscar-limpiar)"[^>]*href="([^"]+)"/g)].map((m) => m[1])
    assert.equal(hrefs.length, 5)
    for (const h of hrefs) assert.doesNotMatch(h, /pagina/)
    assert.doesNotMatch(elements(html, 'form', 'buscar').join(''), /name="pagina"/)

    const last = (await b.go('/pedidos?q=07/2026&estado=fuera_de_ventana&pagina=8')).html
    assert.match(pager(last), /351–374 de 374/)
    assert.equal(refs(last).length, 24)
    assert.equal(relHref(last, 'next'), null)
    for (const narrowed of [last, (await b.go('/pedidos?estado=disponible')).html]) {
      assert.doesNotMatch(text(narrowed), CAP)   // the note is for the whole list only
    }
  })

  test('NUEVO: the header counts the whole list on every page and links to the available ones', async () => {
    const v = new Browser()
    v.cookies.set('cedivep_session', b.cookies.get('cedivep_session')!)
    v.cookies.set('cedivep_visit', signForTest({ visits: { 3100: ['', '2026-07-23'] } }, 60))
    const page1 = (await v.go('/pedidos')).html
    const page2 = (await v.go('/pedidos?pagina=2')).html
    for (const html of [page1, page2]) {
      assert.match(text(elements(html, 'div', 'pagina-meta').join('')), /5 pedidos nuevos desde tu última visita/)
    }
    assert.deepEqual(news(page1), [])
    assert.deepEqual(news(page2), ['260724/1928', '260724/1927', '260724/1926', '260724/1925', '260724/1924'])
  })
})

// ───────────────────────────────────────────── startup and failures

describe('/health', () => {
  ownServer()

  test('reports driver, counts and window, never where the DB lives', async () => {
    const r = await fetch(`${base}/health`)
    assert.match(r.headers.get('cache-control') ?? '', /no-store/)
    const body = await r.json()
    assert.deepEqual(Object.keys(body).sort(), ['counts', 'demo', 'driver', 'ok', 'window'])
    assert.equal(body.driver, 'sqlite')
  })
})

/** Runs `next start` with a config and resolves with its exit code, or 'running' after a few seconds. */
async function startWith(env: Record<string, string>): Promise<number | 'running'> {
  const port = await freePort()
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'],
    { env: { ...process.env, ...ENV, ...env }, stdio: 'ignore' })
  const exited = once(child, 'exit').then(([code]) => code as number)
  const result = await Promise.race([exited, new Promise<'running'>((r) => setTimeout(() => r('running'), 8000))])
  if (result === 'running') { child.kill('SIGTERM'); await exited }
  return result
}

describe('startup refuses configs that would expose real data', () => {
  const mysql = { CEDIVEP_DRIVER: 'mysql', DB_HOST: '127.0.0.1', DB_PORT: '1', DB_USER: 'nobody', COOKIE_SECURE: 'true',
    CEDIVEP_DEMO: '0' }

  test('demo mode with the real database', async () => {
    const code = await startWith({ ...mysql, CEDIVEP_DEMO: '1' })
    assert.notEqual(code, 'running')
    assert.notEqual(code, 0)
  })

  test('a short SESSION_SECRET with the real database', async () => {
    const code = await startWith({ ...mysql, SESSION_SECRET: 'too-short' })
    assert.notEqual(code, 'running')
    assert.notEqual(code, 0)
  })
})

describe('database down', () => {
  ownServer({ CEDIVEP_DRIVER: 'mysql', DB_HOST: '127.0.0.1', DB_PORT: '1', DB_USER: 'nobody', COOKIE_SECURE: 'true',
    CEDIVEP_DEMO: '0' })

  test('login answers with the friendly error, not a blank 500', async () => {
    const r = await new Browser().go('/api/login', { contact: '0981 000 001' })
    assert.equal(r.location, '/?error=inesperado')
  })
})
