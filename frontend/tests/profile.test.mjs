import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(relative) {
  const file = fileURLToPath(new URL(`../src/${relative}`, import.meta.url))
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  runInNewContext(source, { module, exports: module.exports })
  return module.exports
}

const { ageFromDob, isValidDob, displayValue, formatDob, initialOf } = load('components/profile/format.ts')
const { profileStrings } = load('components/profile/strings.ts')
const now = new Date('2026-10-25T12:00:00Z')

test('dates of birth are validated as real, past calendar dates', () => {
  assert.equal(isValidDob('2005-08-04', now), true)
  assert.equal(isValidDob('2005-02-30', now), false)
  assert.equal(isValidDob('2027-01-01', now), false)
  assert.equal(isValidDob('04/08/2005', now), false)
  assert.equal(isValidDob('', now), false)
})

test('age is derived from date of birth', () => {
  assert.equal(ageFromDob('2005-08-04', now), 21)
  assert.equal(ageFromDob('2005-10-26', now), 20)
  assert.equal(ageFromDob('2005-10-25', now), 21)
  assert.equal(ageFromDob('2026-04-25', now), 0.5)
  assert.equal(ageFromDob('nonsense', now), undefined)
})

test('display helpers fall back for empty values', () => {
  assert.equal(displayValue(''), '-')
  assert.equal(displayValue('  '), '-')
  assert.equal(displayValue(undefined, 'None'), 'None')
  assert.equal(displayValue(' O+ '), 'O+')
  assert.equal(formatDob(undefined), '-')
  assert.match(formatDob('2005-08-04'), /4 Aug 2005/)
  assert.equal(initialOf(' suyash'), 'S')
  assert.equal(initialOf(''), '?')
})

test('Hindi and English profile strings define the same keys', () => {
  const en = profileStrings('en')
  const hi = profileStrings('hi')
  assert.deepEqual(Object.keys(hi).sort(), Object.keys(en).sort())
  assert.notEqual(hi.logout, en.logout)
})
