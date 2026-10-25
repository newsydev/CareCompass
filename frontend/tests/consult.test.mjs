import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(relative) {
  const file = fileURLToPath(new URL(`../src/${relative}`, import.meta.url))
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  runInNewContext(source, { module, exports: module.exports })
  return module.exports
}

const { isChatActive, formatConsultDate } = load('components/consult/format.ts')

test('a chat is active until a decision is reached', () => {
  assert.equal(isChatActive({ messages: [{ role: 'user' }] }), true)
  assert.equal(isChatActive({ messages: [{ role: 'user' }, { role: 'assistant' }], result: { follow_up_question: 'How long?' } }), true)
  assert.equal(isChatActive({ messages: [{ role: 'user' }], result: { follow_up_question: null } }), true)
  assert.equal(isChatActive({ messages: [{ role: 'user' }, { role: 'assistant' }], result: { follow_up_question: null } }), false)
})

test('dates read like "24 Oct, 7:30 pm" and bad input is empty', () => {
  const text = formatConsultDate('2026-10-24T14:00:00Z')
  assert.match(text, /^\d{1,2} \w{3}, \d{1,2}:\d{2} (am|pm)$/)
  assert.equal(formatConsultDate('nope'), '')
})
