import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const { outputText } = ts.transpileModule(readFileSync(new URL('../src/utils/localizeNames.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
})
const module = { exports: {} }
runInNewContext(outputText, { module, exports: module.exports })
const l = module.exports
const roster = readFileSync(new URL('../../data/caregivers.csv', import.meta.url), 'utf8').trim().split(/\r?\n/).slice(1).map((line) => line.split(','))

test('caregiver names become Devanagari in Hindi and stay Latin in English', () => {
  assert.equal(l.localName('Ritu Kumar', 'hi'), 'ऋतु कुमार')
  assert.equal(l.localName('Divya Rawat', 'hi'), 'दिव्या रावत')
  assert.equal(l.localName('Pawan Das', 'hi'), 'पवन दास')
  assert.equal(l.localName('Pawan Das', 'en'), 'Pawan Das')
  assert.equal(l.localName('Unknown Person', 'hi'), 'Unknown Person')
  assert.equal(l.localName(undefined, 'hi'), '')
})

test('every roster name is fully translated', () => {
  const names = [...new Set(roster.map((row) => row[1]))]
  assert.ok(names.length > 20)
  for (const name of names) assert.match(l.localName(name, 'hi'), /^[ऀ-ॿ ]+$/, name)
})

test('roles, areas, qualifications and languages localize only in Hindi', () => {
  assert.equal(l.localRole('medic', 'hi'), 'मेडिक')
  assert.equal(l.localRole('medic', 'hi', true), 'नर्स / मेडिक')
  assert.equal(l.localRole('medic', 'en'), undefined)
  assert.equal(l.localArea('Noida Sec 18', 'hi'), 'नोएडा सेक्टर 18')
  assert.equal(l.localArea('Noida Sec 18', 'en'), 'Noida Sec 18')
  assert.equal(l.localQualification('MBBS', 'hi'), 'एमबीबीएस')
  assert.equal(l.localLanguage('Punjabi', 'hi'), 'पंजाबी')
  assert.equal(l.localSkill('wound_dressing', 'hi'), 'घाव की ड्रेसिंग')
  assert.equal(l.localSkill('wound_dressing', 'en'), null)
})

test('match reasons are fully Hindi, including tier, skill and tomorrow slot', () => {
  const reason = 'Hindi-speaking, distance not verified (location not shared), free 10:00–16:00, skilled in wound dressing, standard tier (next slot tomorrow)'
  const out = l.localizeMatchReason(reason, 'hi')
  assert.equal(out, 'हिंदी-भाषी, दूरी सत्यापित नहीं (स्थान साझा नहीं), उपलब्ध समय 10:00–16:00, कौशल: घाव की ड्रेसिंग, स्टैंडर्ड टियर (अगला समय कल)')
  assert.doesNotMatch(out, /[A-Za-z]/)
  assert.equal(l.localizeMatchReason('Hindi-speaking, 3.2 km away, free 09:00–15:00, expert tier', 'hi'), 'हिंदी-भाषी, 3.2 किमी दूर, उपलब्ध समय 09:00–15:00, एक्सपर्ट टियर')
  assert.equal(l.localizeMatchReason('English-speaking, virtual consult, free 14:00–17:00, ★3.9', 'hi'), 'अंग्रेज़ी-भाषी, ऑनलाइन परामर्श, उपलब्ध समय 14:00–17:00, ★3.9')
  assert.equal(l.localizeMatchReason(reason, 'en'), reason)
})

test('matching notes localize known backend messages and leave unknown ones alone', () => {
  assert.match(l.localizeMatchingNote('Location not shared, so service radius and distance could not be verified.', 'hi'), /स्थान साझा नहीं/)
  const none = l.localizeMatchingNote('No eligible medic found for this request: 3 outside service radius, 2 below required tier. Try a teleconsultation, or call 112 if symptoms worsen.', 'hi')
  assert.match(none, /मेडिक/)
  assert.match(none, /सेवा क्षेत्र से बाहर: 3/)
  assert.equal(l.localizeMatchingNote('Something new', 'hi'), 'Something new')
  assert.equal(l.localizeMatchingNote('Location not shared, so service radius and distance could not be verified.', 'en'), 'Location not shared, so service radius and distance could not be verified.')
})

test('assessment text and labels have Hindi and keep English unchanged', () => {
  assert.match(l.localizeAssessmentText('Temperature is unknown.', 'hi'), /तापमान/)
  assert.equal(l.localizeAssessmentText('Temperature is unknown.', 'en'), 'Temperature is unknown.')
  assert.equal(l.localizeAssessmentText('Brand new backend sentence.', 'hi'), 'Brand new backend sentence.')
  const en = l.assessmentLabels('en')
  const hi = l.assessmentLabels('hi')
  assert.deepEqual(Object.keys(hi), Object.keys(en))
  assert.equal(en.heading, 'Clinical Safety Guidance & Missing Vitals')
  for (const value of Object.values(hi)) assert.match(value, /[ऀ-ॿ]/)
})
