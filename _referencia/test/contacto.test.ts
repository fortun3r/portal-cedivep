import assert from 'node:assert/strict'
import { test } from 'node:test'
import { canonTelefono, claveDeContacto, correosDe, telefonosDe } from '../src/contacto.js'

test('teléfonos paraguayos en sus mil formatos llegan a la misma forma', () => {
  for (const t of ['0981163342', '981163342', '0981 163 342', '0981-163-342', '+595 981 163342',
                   '595981163342', '00595981163342', '(0981) 163.342']) {
    assert.equal(canonTelefono(t), '981163342', t)
  }
  assert.equal(canonTelefono('021 123 456'), '21123456')   // fijo de Asunción
})

test('descarta lo que no es un teléfono completo', () => {
  for (const t of ['', '123', '754.278', '999999999', '0000000000', 'sin dato']) {
    assert.equal(canonTelefono(t), null, t)
  }
})

test('separa dos números cargados en el mismo campo (dato real de doctor.CELULAR)', () => {
  assert.deepEqual(telefonosDe('981-114.114 - 754.278'), ['981114114'])
  assert.deepEqual(telefonosDe('0981 000 001 / 0971 000 003'), ['981000001', '971000003'])
  assert.deepEqual(telefonosDe('0981.409495  0343 - 420 984'), ['981409495'])
})

test('extrae correos aunque vengan pegados o con texto alrededor', () => {
  assert.deepEqual(correosDe('SSONYCARD87@GMAIL.COM,tuma@vet.com.py'), ['ssonycard87@gmail.com', 'tuma@vet.com.py'])
  assert.deepEqual(correosDe('0343 - 420 -984 DR. ZORRILLA'), [])
})

test('la entrada del usuario se convierte en una clave de búsqueda', () => {
  assert.equal(claveDeContacto(' 0981 163 342 '), 'tel:981163342')
  assert.equal(claveDeContacto('Clinica@Ejemplo.com.py'), 'mail:clinica@ejemplo.com.py')
  assert.equal(claveDeContacto('hola'), null)
  assert.equal(claveDeContacto('a@b'), null)
})
