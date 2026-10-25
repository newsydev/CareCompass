import { useEffect, useRef, useState } from 'react'

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

const RECOGNITION_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was denied. Allow microphone and speech recognition access for this site and your browser or Copilot app in system settings.',
  'service-not-allowed': 'Speech recognition is blocked in this browser. Try opening CareCompass in Chrome or Safari and allowing speech recognition.',
  'audio-capture': 'No microphone is available. Check your microphone connection and system microphone settings.',
  'no-speech': 'No speech was detected. Try again and speak after pressing the microphone button.',
  network: 'The browser speech service could not connect. Check your internet connection or type your request instead.',
  'language-not-supported': 'The selected speech language is unavailable in this browser. Try another language or type your request.',
  aborted: 'Voice input was interrupted. Your captured text is still available to review.',
}

function detachRecognition(recognition: BrowserRecognition) {
  recognition.onresult = null
  recognition.onerror = null
  recognition.onend = null
}

export function useVoiceChat(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [speakingKey, setSpeakingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<BrowserRecognition | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const transcriptCallback = useRef(onTranscript)
  const speechWindow = window as RecognitionWindow
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  const canListen = Boolean(Recognition) && window.isSecureContext
  const canSpeak = Boolean(window.speechSynthesis && window.SpeechSynthesisUtterance)

  useEffect(() => {
    transcriptCallback.current = onTranscript
  }, [onTranscript])

  useEffect(() => () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      detachRecognition(recognition)
      recognition.abort()
    }
    if (utteranceRef.current) {
      utteranceRef.current = null
      window.speechSynthesis.cancel()
    }
  }, [])

  function stopSpeaking() {
    utteranceRef.current = null
    setSpeakingKey(null)
    window.speechSynthesis?.cancel()
  }

  function cancelListening() {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (recognition) {
      detachRecognition(recognition)
      recognition.abort()
    }
    setIsListening(false)
    setInterimTranscript('')
  }

  function startListening(baseText: string, language: string) {
    if (!canListen || !Recognition) {
      setError('Voice input is unavailable in this preview. Open CareCompass in Chrome or Safari over localhost or HTTPS, or type your request.')
      return
    }
    if (recognitionRef.current) return

    stopSpeaking()
    setError(null)
    setInterimTranscript('')
    let recognition: BrowserRecognition | null = null
    let capturedText = ''
    let failed = false

    try {
      recognition = new Recognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = language
      recognition.maxAlternatives = 1
      recognitionRef.current = recognition

      recognition.onresult = (event) => {
        if (recognitionRef.current !== recognition) return
        const finalParts: string[] = []
        const interimParts: string[] = []
        // Rebuild this session from the result list, rather than re-appending old results.
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i]
          const text = result[0]?.transcript.trim()
          if (text) (result.isFinal ? finalParts : interimParts).push(text)
        }
        const interim = interimParts.join(' ')
        capturedText = [...finalParts, ...interimParts].join(' ')
        setInterimTranscript(interim)
        transcriptCallback.current([baseText.trim(), capturedText].filter(Boolean).join(' '))
      }
      recognition.onerror = (event) => {
        if (recognitionRef.current !== recognition) return
        failed = true
        setError(RECOGNITION_ERRORS[event.error] ?? `Speech recognition failed (${event.error}). Please type your request or try again.`)
        // Keep the session busy until onend so a late result cannot overwrite a sent draft.
      }
      recognition.onend = () => {
        if (recognitionRef.current !== recognition) return
        recognitionRef.current = null
        setIsListening(false)
        setInterimTranscript('')
        if (!capturedText && !failed) setError(RECOGNITION_ERRORS['no-speech'])
      }
      setIsListening(true)
      recognition.start()
    } catch (failure) {
      if (recognition) detachRecognition(recognition)
      recognitionRef.current = null
      setIsListening(false)
      setError(`Could not start voice input: ${failure instanceof Error ? failure.message : String(failure)}`)
    }
  }

  function stopListening() {
    try {
      recognitionRef.current?.stop()
    } catch (failure) {
      cancelListening()
      setError(`Could not stop voice input: ${failure instanceof Error ? failure.message : String(failure)}`)
    }
  }

  function speak(key: string, text: string, language: string) {
    if (!canSpeak) {
      setError('Read aloud is unavailable in this browser. You can read all replies on screen.')
      return
    }
    if (speakingKey === key) {
      stopSpeaking()
      return
    }

    cancelListening()
    stopSpeaking()
    setError(null)
    try {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = /[\u0900-\u097f]/.test(text) ? 'hi-IN' : language
      const targetPrefix = utterance.lang.split('-')[0].toLowerCase()
      const voices = window.speechSynthesis.getVoices()
      const matchingVoices = voices.filter((voice) => {
        const voiceLang = (voice.lang || '').replace('_', '-').toLowerCase()
        return voiceLang.startsWith(targetPrefix) || (targetPrefix === 'hi' && voice.name.toLowerCase().includes('hindi'))
      })
      const voice = matchingVoices.find((candidate) => candidate.localService) ?? matchingVoices[0]
      if (voice) utterance.voice = voice
      utterance.onend = () => {
        if (utteranceRef.current !== utterance) return
        utteranceRef.current = null
        setSpeakingKey(null)
      }
      utterance.onerror = (event) => {
        if (utteranceRef.current !== utterance) return
        utteranceRef.current = null
        setSpeakingKey(null)
        setError(`Read aloud failed (${event.error}). Please read the reply on screen.`)
      }
      utteranceRef.current = utterance
      setSpeakingKey(key)
      window.speechSynthesis.speak(utterance)
    } catch (failure) {
      stopSpeaking()
      setError(`Could not read the reply aloud: ${failure instanceof Error ? failure.message : String(failure)}`)
    }
  }

  return {
    canListen, canSpeak, isListening, interimTranscript, speakingKey, error,
    startListening, stopListening, cancelListening, speak, stopSpeaking,
    clearError: () => setError(null),
  }
}
