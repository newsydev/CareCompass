import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(
  readFileSync(new URL('../src/hooks/useVoiceChat.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText

function createHarness({ recognitionSupported = true, synthesisSupported = true, secure = true, startError = false } = {}) {
  const slots = []
  let cursor = 0
  let transcript = ''
  let cancelled = 0
  const recordings = []
  const spoken = []
  const voices = [
    { lang: 'en-IN', localService: false, name: 'Remote English' },
    { lang: 'en-IN', localService: true, name: 'Local English' },
    { lang: 'hi-IN', localService: true, name: 'Local Hindi' },
  ]
  class Recognition {
    constructor() { recordings.push(this) }
    start() {
      if (startError) throw new Error('start blocked')
      this.started = true
    }
    stop() { this.stopRequested = true }
    abort() {
      this.aborted = true
      this.onend?.()
    }
    emit(parts) {
      this.onresult?.({
        results: parts.map(([text, isFinal]) => ({ 0: { transcript: text }, isFinal })),
      })
    }
    end() { this.onend?.() }
    fail(error) { this.onerror?.({ error }) }
  }
  class Utterance {
    constructor(text) { this.text = text }
  }
  const synthesis = {
    getVoices: () => voices,
    speak: utterance => spoken.push(utterance),
    cancel: () => {
      cancelled++
      spoken.at(-1)?.onerror?.({ error: 'canceled' })
    },
  }
  const react = {
    useState(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { value: initial }
      return [slots[index].value, value => { slots[index].value = value }]
    },
    useRef(initial) {
      const index = cursor++
      if (!slots[index]) slots[index] = { current: initial }
      return slots[index]
    },
    useEffect(effect, deps) {
      const index = cursor++
      const previous = slots[index]
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        previous?.cleanup?.()
        slots[index] = { deps, cleanup: effect() }
      }
    },
  }
  const context = {
    exports: {},
    require: () => react,
    SpeechSynthesisUtterance: Utterance,
    window: {
      isSecureContext: secure,
      webkitSpeechRecognition: recognitionSupported ? Recognition : undefined,
      speechSynthesis: synthesisSupported ? synthesis : undefined,
      SpeechSynthesisUtterance: synthesisSupported ? Utterance : undefined,
    },
  }
  runInNewContext(source, context)
  const onTranscript = text => { transcript = text }
  function render() {
    cursor = 0
    return context.exports.useVoiceChat(onTranscript)
  }
  return {
    render, recordings, spoken, synthesis,
    get transcript() { return transcript },
    get cancelled() { return cancelled },
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
  }
}

test('mount does not request a microphone or start audio', () => {
  const h = createHarness()
  const voice = h.render()
  assert.equal(voice.canListen, true)
  assert.equal(voice.canSpeak, true)
  assert.equal(voice.isListening, false)
  assert.equal(h.recordings.length, 0)
  assert.equal(h.spoken.length, 0)
})

test('dictation preserves typed input and all final segments without duplicating repeated results', () => {
  const h = createHarness()
  h.render().startListening('For my father:', 'en-IN')
  const recording = h.recordings[0]
  assert.equal(recording.lang, 'en-IN')
  assert.equal(recording.interimResults, true)
  recording.emit([['fever', true], ['for two', false]])
  assert.equal(h.transcript, 'For my father: fever for two')
  assert.equal(h.render().interimTranscript, 'for two')
  recording.emit([['fever', true], ['for two days', true]])
  recording.emit([['fever', true], ['for two days', true]])
  assert.equal(h.transcript, 'For my father: fever for two days')
  assert.equal(h.render().interimTranscript, '')
})

test('stop waits for the final result and never submits a transcript', () => {
  const h = createHarness()
  h.render().startListening('', 'hi-IN')
  const recording = h.recordings[0]
  recording.emit([['draft', false]])
  h.render().stopListening()
  assert.equal(recording.stopRequested, true)
  assert.equal(h.render().isListening, true)
  recording.emit([['final transcript', true]])
  recording.end()
  assert.equal(h.transcript, 'final transcript')
  assert.equal(h.render().isListening, false)
  assert.equal(h.spoken.length, 0)
})

test('an ended session cannot overwrite the next dictation session', () => {
  const h = createHarness()
  h.render().startListening('', 'en-IN')
  const first = h.recordings[0]
  first.emit([['first', true]])
  first.end()
  h.render().startListening(h.transcript, 'en-IN')
  first.emit([['stale', true]])
  h.recordings[1].emit([['second', true]])
  assert.equal(h.transcript, 'first second')
})

test('permission, microphone, network, silence and language failures are explicit', () => {
  for (const [code, message] of [
    ['not-allowed', 'denied'],
    ['service-not-allowed', 'blocked'],
    ['audio-capture', 'microphone'],
    ['network', 'connect'],
    ['no-speech', 'No speech'],
    ['language-not-supported', 'language'],
    ['unexpected', 'unexpected'],
  ]) {
    const h = createHarness()
    h.render().startListening('', 'en-IN')
    h.recordings[0].fail(code)
    h.recordings[0].end()
    assert.ok(h.render().error.includes(message), code)
    assert.equal(h.render().isListening, false)
  }
})

test('silence and start failures leave the chat usable', () => {
  const h = createHarness()
  h.render().startListening('typed', 'en-IN')
  h.recordings[0].end()
  assert.match(h.render().error, /No speech/)
  assert.equal(h.render().isListening, false)
  const blocked = createHarness({ startError: true })
  blocked.render().startListening('', 'en-IN')
  assert.match(blocked.render().error, /start blocked/)
  assert.equal(blocked.render().isListening, false)
})

test('unsupported and insecure browsers do not try to start recognition', () => {
  for (const options of [{ recognitionSupported: false }, { secure: false }]) {
    const h = createHarness(options)
    assert.equal(h.render().canListen, false)
    h.render().startListening('', 'en-IN')
    assert.match(h.render().error, /unavailable/)
    assert.equal(h.recordings.length, 0)
  }
  const h = createHarness({ synthesisSupported: false })
  h.render().speak('test', 'Hello', 'en-IN')
  assert.equal(h.render().canSpeak, false)
  assert.match(h.render().error, /unavailable/)
})

test('speaker prefers local voices, handles Hindi, and toggles playback', () => {
  const h = createHarness()
  h.render().speak('welcome', 'Hi John', 'en-IN')
  assert.equal(h.render().speakingKey, 'welcome')
  assert.equal(h.spoken[0].voice.name, 'Local English')
  h.render().speak('welcome', 'Hi John', 'en-IN')
  assert.equal(h.render().speakingKey, null)
  assert.equal(h.render().error, null)
  h.render().speak('hindi', '\u0928\u092e\u0938\u094d\u0924\u0947', 'en-IN')
  assert.equal(h.spoken.at(-1).lang, 'hi-IN')
  assert.equal(h.spoken.at(-1).voice.name, 'Local Hindi')
})

test('stale speech callbacks cannot stop newer playback', () => {
  const h = createHarness()
  h.render().speak('first', 'First', 'en-IN')
  const first = h.spoken[0]
  h.render().speak('second', 'Second', 'en-IN')
  first.onend()
  assert.equal(h.render().speakingKey, 'second')
  assert.equal(h.render().error, null)
  h.spoken[1].onend()
  assert.equal(h.render().speakingKey, null)
})

test('speech failures are visible and release playback state', () => {
  const h = createHarness()
  h.render().speak('reply', 'Read me', 'en-IN')
  h.spoken[0].onerror({ error: 'not-allowed' })
  assert.equal(h.render().speakingKey, null)
  assert.match(h.render().error, /not-allowed/)
  h.synthesis.speak = () => { throw new Error('speaker failed') }
  h.render().speak('retry', 'Read me', 'en-IN')
  assert.equal(h.render().speakingKey, null)
  assert.match(h.render().error, /speaker failed/)
})

test('starting the mic stops playback and starting playback aborts the mic', () => {
  const h = createHarness()
  h.render().speak('welcome', 'Welcome', 'en-IN')
  h.render().startListening('', 'en-IN')
  assert.equal(h.render().speakingKey, null)
  assert.equal(h.render().isListening, true)
  const recording = h.recordings[0]
  recording.emit([['review this', false]])
  h.render().speak('reply', 'Reply', 'en-IN')
  assert.equal(recording.aborted, true)
  assert.equal(h.render().isListening, false)
  recording.emit([['late result', true]])
  assert.equal(h.transcript, 'review this')
})

test('unmount aborts recognition and cancels active audio without stale updates', () => {
  const recordingHarness = createHarness()
  recordingHarness.render().startListening('', 'en-IN')
  const recording = recordingHarness.recordings[0]
  recordingHarness.unmount()
  assert.equal(recording.aborted, true)
  assert.equal(recording.onresult, null)
  const speechHarness = createHarness()
  speechHarness.render().speak('reply', 'Reply', 'en-IN')
  const before = speechHarness.cancelled
  speechHarness.unmount()
  assert.equal(speechHarness.cancelled, before + 1)
})
