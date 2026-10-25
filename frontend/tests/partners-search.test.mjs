import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(relative) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(new URL(`../src/utils/${relative}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  runInNewContext(source, { module, exports: module.exports })
  return module.exports
}

const partners = load('partners.ts')
const names = load('localizeNames.ts')
const roster = [
  { caregiver_id: 'a', name: 'Ritu Kumar', role: 'medic', base_area: 'Noida', rating: 5 },
  { caregiver_id: 'b', name: 'Pawan Das', role: 'medic', base_area: 'Noida', rating: 4.9 },
]
const extra = (p) => [names.localName(p.name, 'hi'), names.localRole(p.role, 'hi', true)]

test('Latin search still works without localized text', () => {
  assert.equal(partners.visiblePartners(roster, null, 'ritu').map((p) => p.caregiver_id).join(),'a')
})

test('Devanagari name and role match when localized text is supplied', () => {
  const hindiName = names.localName('Ritu Kumar', 'hi')
  assert.match(hindiName, /[ऀ-ॿ]/)
  assert.equal(partners.visiblePartners(roster, null, hindiName, extra).map((p) => p.caregiver_id).join(),'a')
  assert.equal(partners.visiblePartners(roster, null, hindiName).length, 0)
  assert.equal(partners.visiblePartners(roster, null, 'मेडिक', extra).length, 2)
})
