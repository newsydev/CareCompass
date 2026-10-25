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

const {
  initialVoiceState, voiceReducer, greetingText, firstName, isDecidedResponse, isEmergencyResponse, spokenReply, phaseLabelKey,
} = load('components/voice/sessionState.ts')
const { chunkText, speechWatchdogMs, silenceTimeoutMs, mergeTranscript, GAP_BEFORE_LISTEN_MS } = load('components/voice/speech.ts')

const base = { follow_up_question: null, care_type: null, urgency: null, red_flags: [], reasoning: null, matched_caregivers: [] }
const describe = (response) => response.follow_up_question ?? `Suggested service: ${response.care_type}.\nMore detail.`

test('reducer walks the listen, think, speak loop and ignores late interim text', () => {
  let state = voiceReducer(initialVoiceState, { type: 'greet', text: 'Hi' })
  assert.equal(state.phase, 'greeting')
  state = voiceReducer(state, { type: 'listen' })
  state = voiceReducer(state, { type: 'interim', text: 'head' })
  assert.equal(state.transcript, 'head')
  state = voiceReducer(state, { type: 'heard', text: 'headache' })
  assert.equal(state.phase, 'thinking')
  assert.equal(voiceReducer(state, { type: 'interim', text: 'late' }).transcript, 'headache')
  state = voiceReducer(state, { type: 'reply', text: 'Since when?', final: false })
  assert.equal(state.phase, 'speaking')
  assert.equal(voiceReducer(state, { type: 'pause' }).phase, 'idle')
})

test('failures keep the transcript and handoff is not undone by pause', () => {
  let state = voiceReducer({ ...initialVoiceState, transcript: 'chest pain' }, { type: 'fail', kind: 'api', message: 'x' })
  assert.equal(state.phase, 'error')
  assert.equal(state.transcript, 'chest pain')
  assert.equal(voiceReducer(state, { type: 'listen' }).errorKind, null)
  state = voiceReducer(state, { type: 'handoff' })
  assert.equal(voiceReducer(state, { type: 'pause' }).phase, 'done')
})

test('greeting is spoken in the chosen language with the first name', () => {
  assert.match(greetingText('Suyash Prakash', 'en'), /^Hi Suyash, I'm your CareCompass assistant/)
  assert.match(greetingText('Suyash Prakash', 'hi'), /^नमस्ते Suyash/)
  assert.equal(firstName('  '), '')
  assert.doesNotMatch(greetingText('', 'en'), /Hi ,/)
})

test('emergencies and recommendations end the voice session, follow-ups do not', () => {
  const emergency = { ...base, red_flags: ['chest_pain'] }
  assert.equal(isEmergencyResponse(emergency), true)
  const spokenEmergency = spokenReply(emergency, 'en', describe)
  assert.equal(spokenEmergency.final, true)
  assert.match(spokenEmergency.text, /112 or 102/)

  const decided = { ...base, care_type: 'lab_test_home', action: 'answer', assessment: { level: 'self_care_support' } }
  assert.equal(isDecidedResponse(decided), true)
  const spoken = spokenReply(decided, 'en', describe)
  assert.equal(spoken.final, true)
  assert.match(spoken.text, /^Suggested service: lab_test_home\./)
  assert.doesNotMatch(spoken.text, /More detail/)

  const followUp = {
    ...base, follow_up_question: 'How long?', action: 'ask_followup',
    questions: [{ question_id: 'q', question_text: 'How long?', summary_label: 'Duration', input_type: 'single_choice', required: true, allow_custom_input: true,
      options: [{ value: 'a', label: 'Today' }, { value: 'b', label: '2 days' }, { value: 'c', label: 'A week' }, { value: 'd', label: 'More' }, { value: 'e', label: 'Extra' }] }],
  }
  const asked = spokenReply(followUp, 'en', describe)
  assert.equal(asked.final, false)
  assert.equal(asked.text, 'How long? Options: Today, 2 days, A week, More.')
  assert.match(spokenReply(followUp, 'hi', describe).text, /विकल्प: Today/)

  const chitChat = { ...base, action: 'answer', message: 'Hello', follow_up_question: null }
  assert.equal(isDecidedResponse(chitChat), false)
  assert.equal(spokenReply(chitChat, 'en', describe).final, false)
})

test('long replies are chunked by sentence and phase labels map greeting to speaking', () => {
  const chunks = chunkText('First sentence. Second sentence! ' + 'word '.repeat(80), 60)
  assert.ok(chunks.length > 3)
  assert.ok(chunks.every((chunk) => chunk.length <= 60))
  assert.equal(JSON.stringify(chunkText('एक। दो।')), JSON.stringify(['एक।', 'दो।']))
  assert.equal(phaseLabelKey('greeting'), 'speaking')
  assert.equal(phaseLabelKey('listening'), 'listening')
})

test('watchdog scales with text length and stays within sane bounds', () => {
  assert.equal(speechWatchdogMs(''), 4000)
  assert.ok(speechWatchdogMs('x'.repeat(100)) > speechWatchdogMs('x'.repeat(20)))
  assert.equal(speechWatchdogMs('x'.repeat(100000)), 60000)
})

test('silence timer waits patiently for the first word, then ends the turn quickly', () => {
  assert.equal(silenceTimeoutMs(''), 9000)
  assert.equal(silenceTimeoutMs('   '), 9000)
  assert.equal(silenceTimeoutMs('mujhe bukhar hai'), 1700)
  assert.ok(GAP_BEFORE_LISTEN_MS >= 400 && GAP_BEFORE_LISTEN_MS <= 600)
})

test('cumulative or repeated recognition results are not duplicated', () => {
  assert.equal(mergeTranscript(['I have', 'I have a headache']), 'I have a headache')
  assert.equal(mergeTranscript(['I have a headache', 'I have']), 'I have a headache')
  assert.equal(mergeTranscript(['headache', 'since two days']), 'headache since two days')
  assert.equal(mergeTranscript(['  ', '']), '')
})

test('silence for several turns pauses with a notice that clears on the next listen', () => {
  let state = voiceReducer(initialVoiceState, { type: 'listen' })
  state = voiceReducer(state, { type: 'silence' })
  assert.equal(state.phase, 'idle')
  assert.equal(state.notice, 'noSpeech')
  assert.equal(voiceReducer(state, { type: 'listen' }).notice, '')
  assert.equal(voiceReducer(voiceReducer(state, { type: 'handoff' }), { type: 'silence' }).phase, 'done')
})
