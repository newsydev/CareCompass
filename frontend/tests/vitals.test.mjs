import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(path, requireMap = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  })
  const module = { exports: {} }
  runInNewContext(outputText, { module, exports: module.exports, require: (name) => requireMap[name] ?? {} })
  return module.exports
}

const plain = (v) => JSON.parse(JSON.stringify(v))
const patientContext = load('../src/utils/patientContext.ts')
const s = load('../src/utils/vitalsStore.ts', { './patientContext': patientContext })

function fakeStorage(initial = {}) {
  const data = { ...initial }
  return { data, getItem: (k) => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = v }, removeItem: (k) => { delete data[k] } }
}
const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
const E = 'A@b.com'
const t = (n) => new Date(Date.UTC(2026, 0, 1, 0, n))

test('add, remove and clear', () => {
  const st = fakeStorage()
  assert.deepEqual(plain(s.loadEntries(E, st)), [])
  s.addEntry(E, { heart_rate: 70 }, t(1), st)
  const list = s.addEntry(E, { heart_rate: 80 }, t(2), st)
  assert.equal(list.length, 2)
  assert.equal(list[0].values.heart_rate, 80)
  assert.ok('carecompass.vitals:a@b.com' in st.data)
  assert.equal(s.removeEntry(E, list[0].id, st)[0].values.heart_rate, 70)
  assert.equal(s.clearEntries(E, st).length, 0)
  assert.equal(s.loadEntries(E, st).length, 0)
})

test('latest by measure uses newest entry that has each measure', () => {
  const st = fakeStorage()
  s.addEntry(E, { temperature_c: 37, heart_rate: 70, systolic_bp: 120, diastolic_bp: 80 }, t(1), st)
  const list = s.addEntry(E, { heart_rate: 90, systolic_bp: 130 }, t(2), st)
  const m = Object.fromEntries(s.latestByMeasure(list).map((x) => [x.key, x.value]))
  assert.equal(m.heart_rate, '90')
  assert.equal(m.temperature_c, '37')
  assert.equal(m.blood_pressure, '120/80') // newest entry lacks diastolic
  assert.equal(m.respiratory_rate, undefined)
})

test('cap keeps newest 50', () => {
  const st = fakeStorage()
  let list = []
  for (let i = 0; i < 55; i++) list = s.addEntry(E, { heart_rate: 60 + (i % 100) }, t(i), st)
  assert.equal(list.length, 50)
  assert.equal(list[0].values.heart_rate, 60 + 54)
  assert.equal(s.loadEntries(E, st).length, 50)
})

test('corrupt storage is tolerated and bad items dropped', () => {
  assert.deepEqual(plain(s.loadEntries(E, fakeStorage({ 'carecompass.vitals:a@b.com': '{nope' }))), [])
  assert.deepEqual(plain(s.loadEntries(E, fakeStorage({ 'carecompass.vitals:a@b.com': '{"a":1}' }))), [])
  const mixed = JSON.stringify([
    null, { id: 1 }, { id: 'x', recordedAt: 'garbage', values: { heart_rate: 70 } },
    { id: 'y', recordedAt: t(1).toISOString(), values: { heart_rate: 9999, temperature_c: 'hot' } },
    { id: 'ok', recordedAt: t(2).toISOString(), values: { heart_rate: 70, junk: 5 } },
  ])
  const out = plain(s.loadEntries(E, fakeStorage({ 'carecompass.vitals:a@b.com': mixed })))
  assert.deepEqual(out, [{ id: 'ok', recordedAt: t(2).toISOString(), values: { heart_rate: 70 } }])
})

test('blocked or missing storage never throws', () => {
  assert.deepEqual(plain(s.loadEntries(E, blocked)), [])
  assert.equal(s.addEntry(E, { heart_rate: 70 }, t(1), blocked).length, 1) // kept in memory
  assert.equal(s.removeEntry(E, 'x', blocked).length, 0)
  assert.equal(s.clearEntries(E, blocked).length, 0)
  assert.deepEqual(plain(s.loadEntries(E, null)), [])
  assert.equal(s.addEntry(E, { heart_rate: 70 }, t(1), null).length, 1)
})

test('validation reuses shared ranges', () => {
  assert.match(s.validateVitalValues({}), /at least one/i)
  assert.equal(s.validateVitalValues({ heart_rate: 72 }), null)
  assert.match(s.validateVitalValues({ temperature_c: 99 }), /between 30 and 45/)
  assert.match(s.validateVitalValues({ heart_rate: NaN }), /between/)
  assert.match(s.validateVitalValues({ systolic_bp: 80, diastolic_bp: 90 }), /greater than/)
  assert.deepEqual(plain(s.parseInputs({ heart_rate: ' 72 ', temperature_c: '' })), { heart_rate: 72 })
})

test('formatters', () => {
  assert.equal(s.formatRecordedAt('nope'), '')
  assert.ok(s.formatRecordedAt(t(0).toISOString()).length > 0)
})
