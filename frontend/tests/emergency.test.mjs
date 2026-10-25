import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(relative, globals = {}) {
  const file = fileURLToPath(new URL(`../src/${relative}`, import.meta.url))
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  runInNewContext(source, { module, exports: module.exports, ...globals })
  return module.exports
}

const { detectCrisis, crisisHelplines, telHref, DEFAULT_HELPLINES } = load('utils/crisis.ts')
const { emergencyStrings } = load('components/emergency/strings.ts')

test('crisis detector catches self-harm in English, Hindi and Hinglish, including typos', () => {
  for (const text of [
    'mujhe sucidal though aa rha hai bro',
    'I am feeling suicidal',
    'i want to kill myself',
    'I want to die.',
    "I don't want to live anymore",
    'thinking of ending my life',
    'main khudkushi karna chahta hu',
    'marna chahta hu yaar',
    'mujhe jaan de dunga lagta hai',
    'मुझे आत्महत्या के विचार आ रहे हैं',
    'मैं मरना चाहता हूँ',
    'जीने का मन नहीं करता',
  ]) assert.equal(detectCrisis(text), true, text)
})

test('crisis detector ignores ordinary complaints and idioms', () => {
  for (const text of [
    'this headache is killing me',
    'I have a fever since two days',
    'sudden chest pain and sweating',
    'my back is killing me after the gym',
    'मुझे सिरदर्द है',
    'mujhe bukhar hai',
    'success story',
    '',
  ]) assert.equal(detectCrisis(text), false, text)
  assert.equal(detectCrisis(null), false)
  assert.equal(detectCrisis(undefined), false)
})

test('helplines always lead with 112 and never repeat', () => {
  assert.equal(crisisHelplines().at(0).number, '112')
  // Arrays built inside the vm context have another realm's prototype, so copy them before deepEqual.
  assert.deepEqual([...crisisHelplines().map((line) => line.number)], ['112', '102', '14416', '1800-599-0019'])
  const lines = crisisHelplines({ kind: 'self_harm', helplines: [{ name: 'Tele-MANAS', number: '1-800-891-4416' }, { name: 'Police', number: '112' }] })
  assert.deepEqual([...lines.map((line) => line.number)], ['112', '1-800-891-4416'])
  assert.ok(DEFAULT_HELPLINES.length >= 4)
  assert.equal(telHref('1-800-891-4416'), 'tel:18008914416')
  assert.equal(telHref('+91 98765-43210'), 'tel:+919876543210')
})

test('English and Hindi emergency strings have the same keys and are honest about ambulances', () => {
  const en = emergencyStrings('en')
  const hi = emergencyStrings('hi')
  assert.deepEqual(Object.keys(hi).sort(), Object.keys(en).sort())
  assert.deepEqual(Object.keys(hi.names).sort(), Object.keys(en.names).sort())
  assert.match(en.honest, /cannot dispatch an ambulance/)
  assert.match(en.callLine('Tele-MANAS', '14416'), /14416/)
  assert.notEqual(hi.headline, en.headline)
})

test('vibration repeats, stops on request and after the hard limit, and is safe without support', async () => {
  const calls = []
  const listeners = new Set()
  const environment = {
    navigator: { vibrate: (pattern) => { calls.push(pattern); return true } },
    document: {
      visibilityState: 'visible',
      addEventListener: (_, fn) => listeners.add(fn),
      removeEventListener: (_, fn) => listeners.delete(fn),
    },
    setInterval, clearInterval, setTimeout, clearTimeout,
  }
  const { startAlertVibration, ALERT_PATTERN } = load('utils/vibrate.ts', environment)
  const stop = startAlertVibration({ repeatMs: 10, maxMs: 1000 })
  await new Promise((resolve) => setTimeout(resolve, 45))
  stop()
  const afterStop = calls.length
  assert.ok(afterStop >= 3, `expected repeats, got ${afterStop}`)
  assert.deepEqual(calls[0], ALERT_PATTERN)
  assert.equal(calls.at(-1), 0)
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.equal(calls.length, afterStop)
  assert.equal(listeners.size, 0)

  calls.length = 0
  startAlertVibration({ repeatMs: 10, maxMs: 25 })
  await new Promise((resolve) => setTimeout(resolve, 80))
  const settled = calls.length
  await new Promise((resolve) => setTimeout(resolve, 40))
  assert.equal(calls.length, settled)
  assert.equal(calls.at(-1), 0)

  const unsupported = load('utils/vibrate.ts', { navigator: {}, document: undefined, setInterval, clearInterval, setTimeout, clearTimeout })
  assert.doesNotThrow(() => unsupported.startAlertVibration()())

  const hidden = load('utils/vibrate.ts', { ...environment, document: { ...environment.document, visibilityState: 'hidden' } })
  assert.ok(hidden.canVibrate())
})

test('vibration stops when the page is hidden', () => {
  const calls = []
  let onVisibility = null
  const document = {
    visibilityState: 'visible',
    addEventListener: (_, fn) => { onVisibility = fn },
    removeEventListener: () => { onVisibility = null },
  }
  const { startAlertVibration } = load('utils/vibrate.ts', {
    navigator: { vibrate: (pattern) => { calls.push(pattern); return true } },
    document, setInterval, clearInterval, setTimeout, clearTimeout,
  })
  startAlertVibration({ repeatMs: 1000, maxMs: 5000 })
  document.visibilityState = 'hidden'
  onVisibility()
  assert.equal(calls.at(-1), 0)
  assert.equal(onVisibility, null)
})
