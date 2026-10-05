import assert from 'node:assert/strict'
import { test } from 'node:test'
import { armarInforme, etiqueta, fecha, resumirPedidos } from '../src/informe.js'
import type { DescresRow, PedidoRow } from '../src/types.js'

const pedido: PedidoRow = {
  FECHA_RECE: '2026-07-28', NRO_RECEPC: '160', REFERENCIA: '260728/160', CLINICA: '2646',
  VETERINARI: '1', FECHA_EXTR: '2026-07-28', FECHA_ENTR: '0000-00-00', URGENTE: 'N',
}

const fila = (o: Partial<DescresRow>): DescresRow => ({
  FEC_PED: '2026-07-28', NROMOV: '160', CODANAL: '2423', NROSEC: '1', ORDEN: '1', UBICACION: '5',
  ANIMAL: 'LOLA', MATERIAL: 'SANGRE', TITULO: 'N', NOMANAL: '', NOMRESULTA: '',
  OBSERVA: '', RESULTADO: '', RELATIVA: '', MEDIDA: '', REFERENCIA: '', UNIDAD: '', DENTRO: 'S',
  SEXOC: 'Hembra', RAZA: 'C.M', EDAD: '3.00 Años', ESPECIE: '', PELAJE: 'SIN PELAJE', ...o,
})

test("TITULO='N' es una medición, no un título (el bug del MVP)", () => {
  const inf = armarInforme(pedido, [
    fila({ UBICACION: 5, TITULO: 'S', NOMRESULTA: 'BIOMETRIA HEMATICA' }),
    fila({ UBICACION: 10, TITULO: 'N', NOMRESULTA: 'Hemoglobina', RESULTADO: '17.3' }),
  ])
  const tipos = inf.animales[0].analisis[0].lineas.map((l) => l.tipo)
  assert.deepEqual(tipos, ['seccion', 'medicion'])
})

test('ordena por UBICACION aunque las filas lleguen desordenadas', () => {
  const inf = armarInforme(pedido, [
    fila({ UBICACION: 45, TITULO: 'S', NOMRESULTA: 'LEUCOGRAMA' }),
    fila({ UBICACION: 10, NOMRESULTA: 'Hemoglobina', RESULTADO: '17.3' }),
    fila({ UBICACION: 5, TITULO: 'S', NOMRESULTA: 'BIOMETRIA HEMATICA' }),
    fila({ UBICACION: 50, NOMRESULTA: 'Glóbulos Blancos', RESULTADO: '12000' }),
  ])
  assert.deepEqual(inf.animales[0].analisis[0].lineas.map((l) => l.prueba),
    ['BIOMETRIA HEMATICA', 'Hemoglobina', 'LEUCOGRAMA', 'Glóbulos Blancos'])
})

test("DENTRO='N' marca fuera de rango, pero no en títulos ni en valores vacíos", () => {
  const inf = armarInforme(pedido, [
    fila({ UBICACION: 5, TITULO: 'S', NOMRESULTA: 'LEUCOGRAMA', DENTRO: 'N' }),
    fila({ UBICACION: 10, NOMRESULTA: 'Neutrofilos en banda', RESULTADO: '03', DENTRO: 'N' }),
    fila({ UBICACION: 15, NOMRESULTA: 'Monocitos', RESULTADO: '', DENTRO: 'N' }),
    fila({ UBICACION: 20, NOMRESULTA: 'Linfocitos', RESULTADO: '18', DENTRO: 'S' }),
  ])
  assert.deepEqual(inf.animales[0].analisis[0].lineas.map((l) => l.fuera), [false, true, false, false])
  assert.equal(inf.fueraDeRango, 1)
})

test('ORDEN separa animales: un rodeo con resultados intercalados por análisis', () => {
  // El orden real del laboratorio: brucelosis 804/806/808, IBR 904/906/908…
  const filas = ['154983', '151667', '126'].flatMap((car, i) => [
    fila({ ORDEN: i + 1, ANIMAL: car, CODANAL: 49, UBICACION: 804 + i * 2, NOMRESULTA: 'INFORME DE BRUCELOSIS', RESULTADO: 'Negativo' }),
    fila({ ORDEN: i + 1, ANIMAL: car, CODANAL: 53, UBICACION: 904 + i * 2, NOMRESULTA: 'IBR (ELISA)', RESULTADO: '80% - POSITIVO' }),
  ])
  const inf = armarInforme(pedido, filas.reverse())
  assert.deepEqual(inf.animales.map((a) => a.identificacion), ['154983', '151667', '126'])
  for (const a of inf.animales) {
    assert.deepEqual(a.analisis.map((x) => x.nombre), ['INFORME DE BRUCELOSIS', 'IBR (ELISA)'])
  }
})

test('los valores de relleno del sistema viejo no se muestran', () => {
  const inf = armarInforme(pedido, [fila({ NOMRESULTA: 'Hemoglobina', RESULTADO: '17.3', RELATIVA: '0' })])
  const a = inf.animales[0]
  assert.equal(a.pelaje, '')             // 'SIN PELAJE'
  assert.equal(a.analisis[0].lineas[0].relativo, '')   // '0'
  assert.equal(inf.fechaEntrega, null)   // '0000-00-00'
})

test('el valor relativo lleva su unidad', () => {
  const inf = armarInforme(pedido, [fila({ NOMRESULTA: 'Neutrofilos', RESULTADO: '76', UNIDAD: '%', RELATIVA: '9120', MEDIDA: '/mm3' })])
  assert.equal(inf.animales[0].analisis[0].lineas[0].relativo, '9.120 /mm3')
})

test('etiqueta y fechas', () => {
  assert.equal(etiqueta({ REFERENCIA: '', FECHA_RECE: '2026-07-24', NRO_RECEPC: 5 }), '260724/  5')
  assert.equal(fecha('0000-00-00'), null)
  assert.equal(fecha('2026-07-31'), '2026-07-31')
})

test('estado del pedido: disponible, en proceso, o fuera de la ventana en línea', () => {
  const p = (f: string, n: number) => ({ ...pedido, FECHA_RECE: f, NRO_RECEPC: n, REFERENCIA: '' })
  const r = resumirPedidos(
    [p('2026-07-28', 160), p('2026-07-29', 1), p('2026-07-01', 2)],
    [fila({ FEC_PED: '2026-07-28', NROMOV: 160, NOMRESULTA: 'Hemoglobina', RESULTADO: '1', DENTRO: 'N' })],
    '2026-07-15',
  )
  assert.deepEqual(r.map((x) => x.estado), ['disponible', 'en_proceso', 'fuera_de_ventana'])
  assert.equal(r[0].fueraDeRango, 1)
})

test('en el listado, un análisis con dos títulos se llama por el primero en el impreso', () => {
  const p = { ...pedido, REFERENCIA: '' }
  const r = resumirPedidos([p], [
    fila({ UBICACION: 45, TITULO: 'S', NOMRESULTA: 'LEUCOGRAMA' }),
    fila({ UBICACION: 10, NOMRESULTA: 'Hemoglobina', RESULTADO: '17' }),
    fila({ UBICACION: 5, TITULO: 'S', NOMRESULTA: 'BIOMETRIA HEMATICA' }),
  ], '2026-07-01')
  assert.deepEqual(r[0].analisis, ['BIOMETRIA HEMATICA'])
})

import { formatoNumero, matrizRodeo } from '../src/informe.js'

test('números como en el informe impreso', () => {
  assert.equal(formatoNumero('7826000'), '7.826.000')
  assert.equal(formatoNumero('11.6'), '11,6')
  assert.equal(formatoNumero('12.0'), '12,0')
  assert.equal(formatoNumero('7500'), '7.500')
  assert.equal(formatoNumero('41'), '41')
  assert.equal(formatoNumero('00'), '00')                       // así se imprime
  assert.equal(formatoNumero('03'), '03')
  assert.equal(formatoNumero('79% - POSITIVO'), '79% - POSITIVO') // texto: intacto
  assert.equal(formatoNumero('0,186 - POSITIVO'), '0,186 - POSITIVO')
  assert.equal(formatoNumero('1/400'), '1/400')
})

test('rodeo: matriz con una fila por animal y una columna por prueba', () => {
  const filas = ['154983', '151667', '126', '105'].flatMap((car, i) => [
    fila({ ORDEN: i + 1, ANIMAL: car, CODANAL: 55, UBICACION: 4 + i * 16, TITULO: 'S', NOMRESULTA: 'LEPTOSPIROSIS' }),
    fila({ ORDEN: i + 1, ANIMAL: car, CODANAL: 55, UBICACION: 6 + i * 16, NOMRESULTA: 'Hardjo',
           RESULTADO: i === 1 ? '1/400' : 'Negativo', REFERENCIA: 'Negativo', DENTRO: i === 1 ? 'N' : 'S' }),
    fila({ ORDEN: i + 1, ANIMAL: car, CODANAL: 49, UBICACION: 804 + i * 2, NOMRESULTA: 'INFORME DE BRUCELOSIS', RESULTADO: 'Negativo' }),
  ])
  const m = matrizRodeo(armarInforme(pedido, filas))!
  assert.ok(m)
  assert.deepEqual(m.columnas.map((c) => `${c.seccion}|${c.prueba}|${c.rango}`),
    ['LEPTOSPIROSIS|Hardjo|Negativo', '|INFORME DE BRUCELOSIS|'])
  assert.deepEqual(m.filas.map((f) => f.animal), ['154983', '151667', '126', '105'])
  assert.deepEqual(m.filas[1].celdas, [{ valor: '1/400', fuera: true }, { valor: 'Negativo', fuera: false }])
})

test('rodeo: con menos de 4 animales, o pruebas distintas, no hay matriz', () => {
  const tres = [1, 2, 3].map((o) => fila({ ORDEN: o, ANIMAL: `A${o}`, NOMRESULTA: 'X', RESULTADO: '1' }))
  assert.equal(matrizRodeo(armarInforme(pedido, tres)), null)
  const mixto = [1, 2, 3, 4].map((o) => fila({ ORDEN: o, ANIMAL: `A${o}`, NOMRESULTA: o === 4 ? 'Y' : 'X', RESULTADO: '1' }))
  assert.equal(matrizRodeo(armarInforme(pedido, mixto)), null)
})
