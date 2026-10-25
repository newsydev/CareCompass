import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/utils/partners.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
})
const module = { exports: {} }
runInNewContext(outputText, { module, exports: module.exports })
const p = module.exports
const plain = (v) => JSON.parse(JSON.stringify(v))
const names = (list) => plain(list.map((x) => x.name))

const data = [
  { caregiver_id: '1', name: 'Bela', role: 'doctor', rating: 4.0, skills: 'teleconsultation;prescription', base_area: 'Noida', active: true },
  { caregiver_id: '2', name: 'Asha', role: 'doctor', rating: 4.0, skills: 'report_review', active: true },
  { caregiver_id: '3', name: 'Cy', role: 'medic', rating: 4.8, skills: 'wound_dressing;;', qualification: 'B.Sc Nursing', active: true },
  { caregiver_id: '4', name: 'Dev', role: 'phlebotomist', active: false },
  { caregiver_id: '5', name: 'Eli', role: 'medic', skills: null },
]

test('parseList splits, trims, dedupes, handles empty', () => {
  assert.deepEqual(plain(p.parseList(' a; b;a;;')), ['a', 'b'])
  assert.deepEqual(plain(p.parseList(null)), [])
})
test('labels are humanised', () => {
  assert.equal(p.roleLabel('medic'), 'Nurse / Medic')
  assert.equal(p.roleLabel('x_y'), 'X Y')
  assert.equal(p.roleLabel(undefined), 'Caregiver')
  assert.equal(p.skillLabel('wound_dressing'), 'Wound Dressing')
})
test('inactive hidden, roles come from data', () => {
  assert.deepEqual(plain(p.rolesPresent(p.activePartners(data))), ['doctor', 'medic'])
})
test('sort rating desc then name, missing rating last', () => {
  assert.deepEqual(names(p.visiblePartners(data, null, '')), ['Cy', 'Asha', 'Bela', 'Eli'])
})
test('filter by role and search', () => {
  assert.deepEqual(names(p.visiblePartners(data, 'doctor', '')), ['Asha', 'Bela'])
  assert.deepEqual(names(p.visiblePartners(data, null, 'wound dress')), ['Cy'])
  assert.deepEqual(names(p.visiblePartners(data, null, 'noida')), ['Bela'])
  assert.deepEqual(plain(p.visiblePartners(data, 'medic', 'zzz')), [])
  assert.deepEqual(plain(p.visiblePartners(undefined, null, '')), [])
})
