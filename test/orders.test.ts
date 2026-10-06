import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  asVisits, countNew, filterOrders, formatDate, groupByDate, isNew, longDate, matchesQuery, recordVisit,
  statusParam, todayPy, windowText,
} from '../src/lib/orders'
import type { OrderSummary } from '../src/lib/types'

const order = (o: Partial<OrderSummary>): OrderSummary => ({
  receivedOn: '2026-07-24', number: 5, label: '260724/  5', status: 'available', deliveryDate: null,
  urgent: false, animals: ['SHAKIRA'], analyses: ['BIOMETRIA HEMATICA'], outOfRange: 1, ...o,
})

const tacuary = [
  order({ receivedOn: '2026-07-28', number: 40, label: '260728/ 40', status: 'in_progress', animals: [], analyses: [] }),
  order({}),
  order({ number: 2, label: '260724/  2', animals: ['ROCKY'], analyses: ['SEROLOGIA'] }),
  order({ receivedOn: '2026-07-22', number: 219, label: '260722/219', animals: ['154983', '151667', '126', '105'],
    analyses: ['LEPTOSPIROSIS', 'INFORME DE BRUCELOSIS'] }),
  order({ receivedOn: '2026-07-10', number: 3, label: '260710/  3', status: 'outside_window', animals: [], analyses: [] }),
]

test('dates: dd/mm/yyyy and the Spanish weekday, without timezone shifts', () => {
  assert.equal(formatDate('2026-07-24'), '24/07/2026')
  assert.equal(formatDate(null), '')
  assert.equal(longDate('2026-07-24'), 'Viernes 24 de julio')
  assert.equal(longDate('2026-07-22'), 'Miércoles 22 de julio')
  assert.equal(longDate('2026-01-01'), 'Jueves 1 de enero')
  assert.equal(longDate('basura'), 'basura')
  const tz = process.env.TZ
  try {
    for (const zone of ['America/Asuncion', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      process.env.TZ = zone
      assert.equal(longDate('2026-07-24'), 'Viernes 24 de julio', zone)
    }
  } finally {
    process.env.TZ = tz
  }
})

test("today in Paraguay is UTC-3, so late evening doesn't jump to tomorrow", () => {
  assert.equal(todayPy(Date.parse('2026-10-05T02:59:00Z')), '2026-10-04')
  assert.equal(todayPy(Date.parse('2026-10-05T03:00:00Z')), '2026-10-05')
})

test('window text repeats the year only when it changes', () => {
  assert.equal(windowText('2026-07-22', '2026-07-24'), 'Resultados en línea del 22/07 al 24/07/2026')
  assert.equal(windowText('2026-12-28', '2027-01-05'), 'Resultados en línea del 28/12/2026 al 05/01/2027')
})

test('groups by date, newest first, keeping the order within the day', () => {
  const g = groupByDate(tacuary)
  assert.deepEqual(g.map((x) => x.title), ['Martes 28 de julio', 'Viernes 24 de julio', 'Miércoles 22 de julio', 'Viernes 10 de julio'])
  assert.deepEqual(g[1].orders.map((o) => o.number), [5, 2])
})

test('search: every term, any tag of a herd, without accents, by date or reference', () => {
  const herd = tacuary[3]
  assert.ok(matchesQuery(herd, '151667'))
  assert.ok(matchesQuery(herd, 'leptospirosis'))
  assert.ok(matchesQuery(order({ analyses: ['BIOMETRIA HEMATICA'] }), 'BIOMETRÍA'))
  assert.ok(matchesQuery(order({}), '24/07/2026'))
  assert.ok(matchesQuery(order({}), '2026-07-24'))
  assert.ok(matchesQuery(order({}), '260724/5'))      // the label has padding spaces
  assert.ok(!matchesQuery(order({}), 'shakira serologia'))
})

test('filter: counts come after the search and before the status filter', () => {
  const all = filterOrders(tacuary, '', null)
  assert.deepEqual(all.counts, { all: 5, available: 3, in_progress: 1, outside_window: 1 })
  const inProgress = filterOrders(tacuary, '', 'in_progress')
  assert.deepEqual(inProgress.orders.map((o) => o.number), [40])
  assert.deepEqual(inProgress.counts, all.counts)
  assert.deepEqual(filterOrders(tacuary, '151667', null).counts, { all: 1, available: 1, in_progress: 0, outside_window: 0 })
})

test('unknown ?estado= values mean "all"', () => {
  assert.equal(statusParam('en_proceso'), 'en_proceso')
  for (const v of ['xyz', '', '__proto__', 'constructor', 'toString', 'DISPONIBLE', undefined, ['disponible']]) {
    assert.equal(statusParam(v), null, String(v))
  }
})

test('new since the last visit: available and received after the previous visit day', () => {
  assert.equal(isNew(order({ receivedOn: '2026-07-24' }), '2026-07-23'), true)
  assert.equal(isNew(order({ receivedOn: '2026-07-23' }), '2026-07-23'), false)
  assert.equal(isNew(order({ status: 'in_progress' }), '2026-07-01'), false)
  assert.equal(isNew(order({}), null), false)
  assert.equal(countNew(tacuary, '2026-07-23'), 2)
})

test('recordVisit: first visit marks nothing; the badge stays for the day and moves the next day', () => {
  const first = recordVisit({}, 2646, '2026-07-23')
  assert.equal(first.previous, null)
  const again = recordVisit(first.visits, 2646, '2026-07-23')
  assert.equal(again.previous, null)
  const nextDay = recordVisit(again.visits, 2646, '2026-07-24')
  assert.equal(nextDay.previous, '2026-07-23')
  // Same day again (filter/search clicks): unchanged, idempotent.
  assert.deepEqual(recordVisit(nextDay.visits, 2646, '2026-07-24'), nextDay)
  // Clinics are tracked separately.
  assert.equal(recordVisit(nextDay.visits, 424, '2026-07-24').previous, null)
})

test('recordVisit keeps at most 10 clinics, dropping the one visited longest ago (not the lowest code)', () => {
  let visits = {}
  // Codes descending, dates ascending: key order and visit order disagree.
  for (let i = 0; i < 12; i++) visits = recordVisit(visits, 1000 - i * 10, `2026-07-${String(10 + i).padStart(2, '0')}`).visits
  const kept = Object.keys(visits)
  assert.equal(kept.length, 10)
  assert.ok(!kept.includes('1000') && !kept.includes('990'), 'the two oldest visits are gone')
  assert.ok(kept.includes('890'), 'the newest is kept')
  // Revisiting a clinic keeps it, and the next new one evicts the oldest of the rest.
  visits = recordVisit(visits, 980, '2026-07-30').visits
  visits = recordVisit(visits, 50, '2026-07-31').visits
  assert.ok(Object.keys(visits).includes('980'))
  assert.ok(Object.keys(visits).includes('50'))
  assert.ok(!Object.keys(visits).includes('970'))
})

test('a visit cookie with an unexpected shape reads as no visits', () => {
  assert.deepEqual(asVisits(null), {})
  assert.deepEqual(asVisits({ visits: 'x' }), {})
  assert.deepEqual(asVisits({ visits: { 2646: ['2026-07-23', '2026-07-24'], x: ['', ''], 9: ['bad', ''], 7: ['', '2026-07-24', 'extra'] } }),
    { 2646: ['2026-07-23', '2026-07-24'] })
})
