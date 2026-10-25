// Thin wrappers over the browser's speech recognition and synthesis for the voice consultation.

interface RecognitionResult {
  readonly isFinal: boolean
  readonly [index: number]: { transcript: string }
}

interface BrowserRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  maxAlternatives: number
  onresult: ((event: { results: ArrayLike<RecognitionResult> }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type RecognitionWindow = Window & {
  SpeechRecognition?: new () => BrowserRecognition
  webkitSpeechRecognition?: new () => BrowserRecognition
}

function recognitionCtor() {
  const w = window as RecognitionWindow
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export function canRecognize() {
  return Boolean(recognitionCtor()) && window.isSecureContext
}

export function canSynthesize() {
  return Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance)
}

export type ListenFailureKind = 'mic' | 'network'

export class ListenFailure extends Error {
  kind: ListenFailureKind
  constructor(kind: ListenFailureKind) {
    super(kind)
    this.kind = kind
  }
}

export interface ListenHandle {
  /** Resolves with the final transcript ('' when nothing was said); rejects with ListenFailure. */
  done: Promise<string>
  stop: () => void
  cancel: () => void
}

/** Pause after the assistant stops talking, so the mic does not hear the tail of its own voice. */
export const GAP_BEFORE_LISTEN_MS = 500
const FIRST_WORD_WAIT_MS = 9000
const END_OF_SPEECH_MS = 1700
const MAX_LISTEN_MS = 45000
const MAX_AUTO_RESTARTS = 4

/** Android Chrome often never fires utterance onend, so every chunk gets a timeout sized to its length. */
export function speechWatchdogMs(text: string) {
  return Math.min(60000, Math.max(4000, 2500 + text.length * 110))
}

/** How long to wait for more speech: patient until the first word, then a short end-of-speech pause. */
export function silenceTimeoutMs(heard: string) {
  return heard.trim() ? END_OF_SPEECH_MS : FIRST_WORD_WAIT_MS
}

/** Joins recognition results; continuous mode on Android repeats cumulative text as separate results. */
export function mergeTranscript(parts: string[]) {
  const out: string[] = []
  for (const raw of parts) {
    const part = raw.trim()
    if (!part) continue
    const last = out[out.length - 1]
    if (last !== undefined && part.startsWith(last)) out[out.length - 1] = part
    else if (last !== undefined && last.startsWith(part)) continue
    else out.push(part)
  }
  return out.join(' ')
}

export function listen(lang: string, onInterim: (text: string) => void): ListenHandle {
  const Ctor = recognitionCtor()
  if (!Ctor || !window.isSecureContext) {
    return { done: Promise.reject(new ListenFailure('mic')), stop: () => undefined, cancel: () => undefined }
  }
  const recognition = new Ctor()
  // Continuous so a pause mid-sentence does not cut the user off; our own silence timer ends the turn.
  recognition.continuous = true
  recognition.interimResults = true
  recognition.lang = lang
  recognition.maxAlternatives = 1

  let cancel = () => undefined as void
  let stop = () => undefined as void
  const done = new Promise<string>((resolve, reject) => {
    let text = ''
    let failure: ListenFailure | null = null
    let settled = false
    let stopping = false
    let restarts = 0
    let silenceTimer: ReturnType<typeof setTimeout> | undefined
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined
    let maxTimer: ReturnType<typeof setTimeout> | undefined
    const clearTimers = () => {
      clearTimeout(silenceTimer)
      clearTimeout(fallbackTimer)
      clearTimeout(maxTimer)
    }
    const detach = () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
    }
    const finish = () => {
      if (settled) return
      settled = true
      clearTimers()
      detach()
      try { recognition.abort() } catch { /* already stopped */ }
      if (failure) reject(failure)
      else resolve(text.trim())
    }
    const requestStop = () => {
      if (settled || stopping) return
      stopping = true
      clearTimeout(silenceTimer)
      // Some browsers never deliver onend after stop(); do not wait forever.
      fallbackTimer = setTimeout(finish, 1500)
      try { recognition.stop() } catch { finish() }
    }
    const arm = () => {
      clearTimeout(silenceTimer)
      silenceTimer = setTimeout(requestStop, silenceTimeoutMs(text))
    }
    recognition.onresult = (event) => {
      const parts: string[] = []
      for (let i = 0; i < event.results.length; i++) {
        const part = event.results[i][0]?.transcript
        if (part) parts.push(part)
      }
      text = mergeTranscript(parts)
      onInterim(text)
      arm()
    }
    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      const denied = ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(event.error)
      failure = new ListenFailure(denied ? 'mic' : 'network')
    }
    recognition.onend = () => {
      if (settled) return
      // The browser can end a session by itself after a few quiet seconds; keep listening if nothing was said yet.
      if (!stopping && !failure && !text && restarts < MAX_AUTO_RESTARTS) {
        restarts += 1
        try {
          recognition.start()
          return
        } catch { /* fall through and settle */ }
      }
      finish()
    }
    cancel = () => {
      if (settled) return
      settled = true
      clearTimers()
      detach()
      try { recognition.abort() } catch { /* already stopped */ }
      resolve('')
    }
    stop = requestStop
    maxTimer = setTimeout(requestStop, MAX_LISTEN_MS)
    arm()
  })
  try {
    recognition.start()
  } catch {
    cancel()
    return { done: Promise.reject(new ListenFailure('mic')), stop, cancel }
  }
  return { done, stop, cancel }
}

function matchingVoices(lang: string) {
  const prefix = lang.split('-')[0].toLowerCase()
  return window.speechSynthesis.getVoices().filter((voice) => {
    const voiceLang = (voice.lang || '').replace('_', '-').toLowerCase()
    return voiceLang.startsWith(prefix) || (prefix === 'hi' && voice.name.toLowerCase().includes('hindi'))
  })
}

/** 'unknown' while the browser has not loaded its voice list yet. */
export function voiceStatus(lang: string): 'ok' | 'missing' | 'unknown' {
  if (!canSynthesize()) return 'missing'
  if (!window.speechSynthesis.getVoices().length) return 'unknown'
  return matchingVoices(lang).length ? 'ok' : 'missing'
}

// Long utterances get cut off in Chrome, so speak sentence-sized chunks one after another.
export function chunkText(text: string, max = 180) {
  const sentences = text.replace(/\s+/g, ' ').trim().split(/(?<=[.!?।])\s+/)
  const chunks: string[] = []
  for (const sentence of sentences) {
    if (!sentence) continue
    let rest = sentence
    while (rest.length > max) {
      const cut = rest.lastIndexOf(' ', max)
      const at = cut > 40 ? cut : max
      chunks.push(rest.slice(0, at).trim())
      rest = rest.slice(at).trim()
    }
    if (rest) chunks.push(rest)
  }
  return chunks
}

let activeUtterance: SpeechSynthesisUtterance | null = null
let activeFinish: (() => void) | null = null

/** Cuts speech off and resolves the pending speak() so a waiting loop can move on. */
export function stopSpeaking() {
  const finish = activeFinish
  activeFinish = null
  if (activeUtterance) {
    activeUtterance.onend = null
    activeUtterance.onerror = null
  }
  activeUtterance = null
  if (canSynthesize()) window.speechSynthesis.cancel()
  finish?.()
}

/** Resolves when speech ends, is cancelled, or fails. Never rejects: the reply stays readable on screen. */
export function speak(text: string, lang: string): Promise<void> {
  if (!canSynthesize()) return Promise.resolve()
  const synth = window.speechSynthesis
  stopSpeaking()
  const chunks = chunkText(text)
  const voices = matchingVoices(lang)
  const voice = voices.find((candidate) => candidate.localService) ?? voices[0]
  return new Promise<void>((resolve) => {
    let index = 0
    let finished = false
    let watchdog: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(watchdog)
      activeUtterance = null
      if (activeFinish === finish) activeFinish = null
      resolve()
    }
    activeFinish = finish
    const next = () => {
      clearTimeout(watchdog)
      if (finished) return
      if (index >= chunks.length) {
        finish()
        return
      }
      const chunk = chunks[index++]
      const utterance = new SpeechSynthesisUtterance(chunk)
      utterance.lang = lang
      if (voice) utterance.voice = voice
      utterance.onend = next
      utterance.onerror = (event) => {
        if (event.error === 'canceled' || event.error === 'interrupted') finish()
        else next()
      }
      watchdog = setTimeout(() => {
        utterance.onend = null
        utterance.onerror = null
        synth.cancel()
        next()
      }, speechWatchdogMs(chunk))
      activeUtterance = utterance
      synth.speak(utterance)
    }
    // Speaking straight after cancel() is silently dropped on some Android builds.
    setTimeout(() => {
      if (finished) return
      try { synth.resume() } catch { /* not paused */ }
      next()
    }, 60)
  })
}
