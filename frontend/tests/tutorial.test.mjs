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

const { TOUR_STEPS } = load('components/tutorial/steps.ts')
const logic = load('components/tutorial/tourLogic.ts')
const { tourStrings, stepCounter } = load('components/tutorial/strings.ts')
const ROUTES = ['/home', '/consult', '/triage', '/partners', '/profile']

test('every step has unique id and target, a known route and EN+HI text', () => {
  assert.ok(TOUR_STEPS.length >= 9)
  assert.equal(new Set(TOUR_STEPS.map((s) => s.id)).size, TOUR_STEPS.length)
  assert.equal(new Set(TOUR_STEPS.map((s) => s.target)).size, TOUR_STEPS.length)
  for (const step of TOUR_STEPS) {
    assert.ok(ROUTES.includes(step.route), step.id)
    for (const lang of ['en', 'hi']) {
      assert.ok(step.title[lang].trim().length > 0, `${step.id} title ${lang}`)
      assert.ok(step.body[lang].trim().length > 0, `${step.id} body ${lang}`)
    }
    assert.match(step.body.hi, /[ऀ-ॿ]/, `${step.id} hindi body is Devanagari`)
    assert.doesNotMatch(step.body.en, /[ऀ-ॿ]/, `${step.id} english body`)
  }
})

test('the tour starts at home and visits each page in one contiguous run', () => {
  assert.equal(TOUR_STEPS[0].route, '/home')
  const runs = TOUR_STEPS.map((s) => s.route).filter((route, i, all) => route !== all[i - 1])
  assert.equal(new Set(runs).size, runs.length)
})

test('index helpers clamp and stop at both ends', () => {
  assert.equal(logic.clampIndex(-3, 5), 0)
  assert.equal(logic.clampIndex(9, 5), 4)
  assert.equal(logic.clampIndex(2, 0), 0)
  assert.equal(logic.stepAfter(0, -1, 5), null)
  assert.equal(logic.stepAfter(4, 1, 5), null)
  assert.equal(logic.stepAfter(2, 1, 5), 3)
  assert.equal(logic.stepAfter(2, -1, 5), 1)
})

test('route matching ignores the query string and narration reads title then body', () => {
  assert.equal(logic.routeMatches('/triage', '/triage'), true)
  assert.equal(logic.pathOf('/triage?lang=hi'), '/triage')
  assert.equal(logic.routeMatches('/home', '/consult'), false)
  const text = logic.narrationText(TOUR_STEPS[0], 'en')
  assert.ok(text.startsWith(TOUR_STEPS[0].title.en))
  assert.ok(text.endsWith(TOUR_STEPS[0].body.en))
  assert.equal(logic.localeFor('hi'), 'hi-IN')
  assert.equal(logic.localeFor('en'), 'en-IN')
  assert.equal(logic.targetSelector(TOUR_STEPS[1]), '[data-tour="start-consultation"]')
})

test('English and Hindi tutorial strings define the same keys', () => {
  assert.deepEqual(Object.keys(tourStrings.hi).sort(), Object.keys(tourStrings.en).sort())
  assert.equal(stepCounter(2, 9, 'en'), 'Step 3 of 9')
  assert.match(stepCounter(2, 9, 'hi'), /3 \/ 9/)
})
