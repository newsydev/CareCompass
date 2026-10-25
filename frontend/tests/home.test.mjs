import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/utils/greeting.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
})
const module = { exports: {} }
runInNewContext(outputText, { module, exports: module.exports })
const { getGreeting, getFirstName } = module.exports
const at = (h, m = 0) => new Date(2026, 0, 1, h, m)

test('greeting by local hour', () => {
  assert.equal(getGreeting(at(0)), 'Good Morning')
  assert.equal(getGreeting(at(11, 59)), 'Good Morning')
  assert.equal(getGreeting(at(12)), 'Good Afternoon')
  assert.equal(getGreeting(at(16, 59)), 'Good Afternoon')
  assert.equal(getGreeting(at(17)), 'Good Evening')
  assert.equal(getGreeting(at(23, 59)), 'Good Evening')
})

test('first name', () => {
  assert.equal(getFirstName('  Suyash Prakash '), 'Suyash')
  assert.equal(getFirstName(''), '')
})
