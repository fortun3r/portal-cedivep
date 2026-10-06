import assert from 'node:assert/strict'
import { mock, test } from 'node:test'
import { asSession, asStep, clientIp, LoginCodes, readSigned, safeReturnPath, sign } from '../src/lib/auth'
import { errorMessage } from '../src/lib/messages'

const tacuary = [{ code: 2646, name: 'CLÍNICA TACUARY' }]

test('return path: only report URLs of this portal', () => {
  for (const ok of ['/pedidos/2026-07-24/5', '/pedidos/2026-07-22/219?hallazgos=1']) assert.equal(safeReturnPath(ok), ok)
  const bad = [null, 1, ['/pedidos/2026-07-24/5'], '', '/pedidos', '/pedidos/', '/pedidos/2026-07-24/5/',
    '/pedidos/2026-07-24/0', '/pedidos/2026-07-24/-1', '//evil.com', '///evil.com', '/\\evil.com', '\\\\evil.com',
    'https://evil.com', 'http:/evil.com', 'javascript:alert(1)', '/pedidos/../elegir', '/pedidos/2026-07-24/5/../../x',
    '/pedidos/%2e%2e/x', '%2Fpedidos%2F2026-07-24%2F5', '/pedidos/2026-07-24/5\r\nSet-Cookie: x=1',
    '/pedidos/2026-07-24/5#x', '/pedidos/2026-07-24/5?hallazgos=1&x=//e', ' /pedidos/2026-07-24/5',
    '/PEDIDOS/2026-07-24/5', '/pedidos/2026-07-24/5@evil.com', '/pedidos/２０２６-07-24/5', '/pedidos/2026-07-24/5\n']
  for (const v of bad) assert.equal(safeReturnPath(v), null, JSON.stringify(v))
})

test('a wrong code gets the same answer whether or not the contact exists', () => {
  const codes = new LoginCodes()
  codes.issue('tel:981000001', tacuary)
  codes.issue('tel:985999777', [])
  assert.deepEqual(codes.verify('tel:981000001', '000000').ok, false)
  assert.deepEqual(codes.verify('tel:981000001', '999999'), codes.verify('tel:985999777', '999999'))
})

test('an unknown contact never logs in, even with its own code', () => {
  const codes = new LoginCodes()
  const r = codes.issue('tel:985999777', [])
  assert.ok(r.ok)
  assert.deepEqual(codes.verify('tel:985999777', r.code), { ok: false, reason: 'incorrect' })
})

test('a code works once and is exhausted after 5 wrong attempts', () => {
  const codes = new LoginCodes()
  const r = codes.issue('tel:981000001', tacuary)
  assert.ok(r.ok)
  assert.equal(codes.verify('tel:981000001', `${r.code.slice(0, 3)} ${r.code.slice(3)}`).ok, true)  // SMS autofill adds a space
  assert.deepEqual(codes.verify('tel:981000001', r.code), { ok: false, reason: 'no_code' })

  const again = codes.issue('tel:981000001', tacuary)
  assert.ok(again.ok)
  const wrong = again.code === '000000' ? '111111' : '000000'
  for (let i = 0; i < 4; i++) assert.equal(codes.verify('tel:981000001', wrong).ok, false)
  assert.deepEqual(codes.verify('tel:981000001', wrong), { ok: false, reason: 'exhausted' })
  assert.deepEqual(codes.verify('tel:981000001', again.code), { ok: false, reason: 'no_code' })
})

test('rate limits: 3 codes per contact per 15 min, 20 per IP', () => {
  const codes = new LoginCodes()
  const r = [1, 2, 3, 4].map(() => codes.admit('tel:981000001', '1.1.1.1'))
  assert.deepEqual(r.map((x) => (x ? x.ok === false && x.reason : null)), [null, null, null, 'limit_contact'])
  const ip = new LoginCodes()
  const results = Array.from({ length: 21 }, (_, i) => ip.admit(`tel:98100${String(i).padStart(4, '0')}`, '2.2.2.2'))
  assert.equal(results.filter(Boolean).length, 1)
})

test('signed cookies: tampering, expiry and shape', () => {
  const s = sign({ allowedClinics: tacuary, currentClinic: tacuary[0] }, 60)
  assert.ok(asSession(readSigned(s)))
  const [body, sig] = s.split('.')
  const forged = Buffer.from(JSON.stringify({ allowedClinics: [{ code: 424, name: 'X' }], exp: Date.now() + 1e6 })).toString('base64url')
  assert.equal(readSigned(`${forged}.${sig}`), null)
  assert.equal(readSigned(`${body}.x${sig}`), null)
  assert.equal(readSigned(sign({ a: 1 }, -1)), null)
  // A step cookie is not a session, and a session is not a step.
  const step = sign({ key: 'tel:981000001' }, 10)
  assert.equal(asSession(readSigned(step)), null)
  assert.equal(asStep(readSigned(s)), null)
  assert.deepEqual(asStep(readSigned(sign({ key: 'tel:981000001', returnTo: '//evil.com' }, 10))),
    { key: 'tel:981000001', returnTo: undefined, demo: undefined })
})

test('error messages: known ?error= codes only', () => {
  assert.match(errorMessage('limite')!, /demasiados códigos/)
  for (const v of ['__proto__', 'toString', 'constructor', 'x', undefined]) assert.equal(errorMessage(v), undefined)
})

test('a contact gets at most 10 codes a day, even spread over the day', () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-05T12:00:00Z') })
  try {
    const codes = new LoginCodes()
    const results: (string | null)[] = []
    for (let window = 0; window < 4; window++) {
      for (let i = 0; i < 3; i++) {
        const r = codes.admit('tel:981000001', `10.0.${window}.${i}`)
        results.push(r && !r.ok ? r.reason : null)
      }
      mock.timers.tick(16 * 60_000)
    }
    assert.deepEqual(results.filter((r) => r === null).length, 10)
    assert.equal(results.at(-1), 'limit_daily')
  } finally {
    mock.timers.reset()
  }
})

test('pending codes are capped; a contact that already has one can still get a new one', () => {
  const codes = new LoginCodes()
  for (let i = 0; i < 20_000; i++) assert.ok(codes.issue(`tel:9${String(i).padStart(8, '0')}`, []).ok)
  assert.deepEqual(codes.issue('tel:981999999', []), { ok: false, reason: 'capacity' })
  assert.ok(codes.issue('tel:900000000', []).ok)
})

test('client IP: IPv6 is keyed by its /64, IPv4 as is', () => {
  const ip = (xff: string) => clientIp(new Headers({ 'x-forwarded-for': xff }))
  assert.equal(ip('2001:db8::1'), ip('2001:DB8:0:0:ffff::2'))
  assert.equal(ip('2001:db8::1'), '2001:db8:0:0::/64')
  assert.notEqual(ip('2001:db8:0:1::1'), ip('2001:db8::1'))
  assert.equal(ip('190.128.1.2'), '190.128.1.2')
  assert.equal(ip('::ffff:127.0.0.1'), '127.0.0.1')
  assert.equal(ip('spoofed, 190.128.1.2'), '190.128.1.2')     // the rightmost entry
  assert.doesNotThrow(() => ip('1:2:3:4:5:6:7:8:9::1'))         // malformed, must not crash
})
