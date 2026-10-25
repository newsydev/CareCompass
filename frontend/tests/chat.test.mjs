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

const { messageSpeechLocale, QUICK_REPLIES } = load('components/chat/speechLang.ts')
const { visibleOptions } = load('utils/followUp.ts')

test('each message is spoken in its own script', () => {
  assert.equal(messageSpeechLocale('यह सिरदर्द कब से है?'), 'hi-IN')
  assert.equal(messageSpeechLocale('How long has this lasted?'), 'en-IN')
  assert.equal(messageSpeechLocale('Take Paracetamol, फिर आराम करें'), 'hi-IN')
})

test('quick replies offer four options in both languages', () => {
  assert.equal(QUICK_REPLIES.en.length, 4)
  assert.equal(QUICK_REPLIES.hi.length, 4)
  assert.ok(QUICK_REPLIES.hi.every((text) => /[ऀ-ॿ]/.test(text)))
})

test('follow-up shows four choices and keeps the rest reachable', () => {
  const options = ['a', 'b', 'c', 'd', 'e', 'none'].map((value) => ({ value }))
  assert.equal(visibleOptions(options.slice(0, 3), false, []).length, 3)
  assert.equal(visibleOptions(options, false, []).length, 4)
  assert.equal(visibleOptions(options, true, []).length, 6)
  assert.equal(visibleOptions(options, false, ['none']).length, 6)
  assert.equal(visibleOptions(options, false, ['a']).length, 4)
})
