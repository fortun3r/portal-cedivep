import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonicalPhone, contactKey, emailsIn, phonesIn } from '../src/lib/contact'

test('Paraguayan phones in their thousand formats reach the same form', () => {
  for (const t of ['0981163342', '981163342', '0981 163 342', '0981-163-342', '+595 981 163342',
                   '595981163342', '00595981163342', '(0981) 163.342']) {
    assert.equal(canonicalPhone(t), '981163342', t)
  }
  assert.equal(canonicalPhone('021 123 456'), '21123456')   // Asunción landline
})

test('discards what is not a full phone', () => {
  for (const t of ['', '123', '754.278', '999999999', '0000000000', 'sin dato']) {
    assert.equal(canonicalPhone(t), null, t)
  }
})

test('splits two numbers loaded in the same field (real doctor.CELULAR data)', () => {
  assert.deepEqual(phonesIn('981-114.114 - 754.278'), ['981114114'])
  assert.deepEqual(phonesIn('0981 000 001 / 0971 000 003'), ['981000001', '971000003'])
  assert.deepEqual(phonesIn('0981.409495  0343 - 420 984'), ['981409495'])
})

test('extracts emails even when glued together or surrounded by text', () => {
  assert.deepEqual(emailsIn('SSONYCARD87@GMAIL.COM,tuma@vet.com.py'), ['ssonycard87@gmail.com', 'tuma@vet.com.py'])
  assert.deepEqual(emailsIn('0343 - 420 -984 DR. ZORRILLA'), [])
})

test("the user's input becomes a lookup key", () => {
  assert.equal(contactKey(' 0981 163 342 '), 'tel:981163342')
  assert.equal(contactKey('Clinica@Ejemplo.com.py'), 'mail:clinica@ejemplo.com.py')
  assert.equal(contactKey('hola'), null)
  assert.equal(contactKey('a@b'), null)
})
