import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { submitTriage } from '../api/careNavigation'
import type { ConversationTurn, CrisisInfo, TriageResponse } from '../api/types'
import { emergencyStrings } from '../components/emergency/strings'
import { detectCrisis } from '../utils/crisis'
import {
  greetingText, initialVoiceState, isEmergencyResponse, spokenReply, voiceReducer,
} from '../components/voice/sessionState'
import {
  GAP_BEFORE_LISTEN_MS, ListenFailure, canRecognize, listen, speak, stopSpeaking, voiceStatus, type ListenHandle,
} from '../components/voice/speech'
import { voiceStrings } from '../components/voice/strings'
import { useDemoSession } from './useDemoSession'
import type { DemoProfile } from '../utils/demoProfile'
import { consultPath, speechLocale } from '../utils/consultLang'
import { describeResponse } from '../utils/chatSummary'
import type { UiLanguage } from '../utils/i18n'
import { patientContextFromProfile } from '../utils/patientContext'

// Each silent turn already waits ~9s for a first word, so three of them is plenty before pausing.
const MAX_SILENT_TURNS = 3
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export function useVoiceSession(language: UiLanguage, profile: DemoProfile) {
  const { activeChatId, saveChat } = useDemoSession()
  const navigate = useNavigate()
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState)
  const [voiceNote, setVoiceNote] = useState(() => voiceStatus(speechLocale(language)))
  // Shown the moment danger is suspected (the patient's own words or the backend), before any reply is spoken.
  const [alert, setAlert] = useState<{ crisis: CrisisInfo | boolean } | null>(null)

  const runId = useRef(0)
  const listening = useRef<ListenHandle | null>(null)
  const history = useRef<ConversationTurn[]>([])
  const lastResult = useRef<TriageResponse | null>(null)
  const emergency = useRef(false)
  const pendingText = useRef<string | null>(null)
  const phase = useRef(state.phase)
  const previousLanguage = useRef(language)
  const latest = useRef({ activeChatId, saveChat, profile, language })
  const supported = canRecognize()

  useEffect(() => {
    latest.current = { activeChatId, saveChat, profile, language }
    phase.current = state.phase
  }, [activeChatId, saveChat, profile, language, state.phase])

  function stopAll() {
    runId.current += 1
    listening.current?.cancel()
    listening.current = null
    stopSpeaking()
  }

  async function handoff() {
    stopAll()
    const { activeChatId: id, saveChat: save, language: lang, profile: current } = latest.current
    const messages = history.current
    dispatch({ type: 'handoff' })
    if (messages.length) {
      const saved = await save({
        id, messages, patientContext: patientContextFromProfile(current), recipient: 'self',
        emergency: emergency.current, result: lastResult.current ?? undefined,
      })
      if (!saved) {
        dispatch({ type: 'fail', kind: 'handoff', message: voiceStrings(lang).handoffFailed })
        return
      }
      // Let the saved chat reach the provider before the chat page reads it.
      await wait(0)
    }
    navigate(consultPath(latest.current.language, 'chat'))
  }

  async function runLoop(options: { greet: boolean; text?: string | null }) {
    const id = ++runId.current
    const live = () => runId.current === id
    // Language is read again every turn so the in-session switch applies from the next listen/speak/request.
    const current = () => latest.current
    let text = options.text ?? null
    let silent = 0

    if (options.greet) {
      const greeting = greetingText(current().profile.name, current().language)
      dispatch({ type: 'greet', text: greeting })
      await speak(greeting, speechLocale(current().language))
      if (!live()) return
    }

    while (live()) {
      if (text === null) {
        // Make sure the speaker is silent and its tail has died away before the mic opens.
        stopSpeaking()
        await wait(GAP_BEFORE_LISTEN_MS)
        if (!live()) return
        dispatch({ type: 'listen' })
        let heard = ''
        try {
          const handle = listen(speechLocale(current().language), (interim) => { if (live()) dispatch({ type: 'interim', text: interim }) })
          listening.current = handle
          heard = await handle.done
        } catch (failure) {
          if (!live()) return
          const mic = !(failure instanceof ListenFailure) || failure.kind === 'mic'
          const strings = voiceStrings(current().language)
          dispatch({ type: 'fail', kind: mic ? 'mic' : 'network', message: mic ? strings.micUnavailable : strings.networkError })
          return
        }
        listening.current = null
        if (!live()) return
        if (!heard) {
          silent += 1
          if (silent >= MAX_SILENT_TURNS) {
            dispatch({ type: 'silence' })
            return
          }
          continue
        }
        text = heard
      }
      silent = 0
      pendingText.current = text
      dispatch({ type: 'heard', text })
      const spokenCrisis = detectCrisis(text)
      if (spokenCrisis) {
        emergency.current = true
        setAlert({ crisis: true })
      }

      const { language: lang, profile: snapshot } = current()
      const context = patientContextFromProfile(snapshot)
      const prior = history.current
      let response: TriageResponse
      try {
        response = await submitTriage({
          user_input: text,
          language: lang,
          location: null,
          conversation_history: prior.map(({ role, content, follow_up_ids, answers }) => ({ role, content, follow_up_ids, answers })),
          patient_context: context,
        })
      } catch {
        if (!live()) return
        dispatch({ type: 'fail', kind: 'api', message: voiceStrings(lang).apiError })
        return
      }
      if (!live()) return
      pendingText.current = null

      const reply = describeResponse(response, lang)
      const questions = response.action === 'ask_followup' ? response.questions ?? [] : []
      history.current = [
        ...prior,
        { role: 'user', content: text, patientContext: context },
        {
          role: 'assistant', content: reply, result: response,
          ...(questions.length ? { follow_up_ids: questions.map((question) => question.question_id) } : {}),
        },
      ]
      lastResult.current = response
      const crisis = spokenCrisis || Boolean(response.crisis)
      const danger = crisis || isEmergencyResponse(response)
      if (danger) {
        emergency.current = true
        setAlert({ crisis: response.crisis ?? crisis })
      }

      // Danger ends the voice loop: say what to do, then hand over to the chat. Never ask the next question.
      const spoken = danger
        ? { text: crisis ? emergencyStrings(lang).crisisSpoken : emergencyStrings(lang).spoken, final: true }
        : spokenReply(response, lang, describeResponse)
      dispatch({ type: 'reply', text: spoken.text, final: spoken.final })
      await speak(spoken.text, speechLocale(lang))
      if (!live()) return
      if (spoken.final) {
        await handoff()
        return
      }
      text = null
    }
  }

  function start() {
    if (!canRecognize()) {
      stopAll()
      dispatch({ type: 'fail', kind: 'mic', message: voiceStrings(latest.current.language).micUnavailable })
      return
    }
    void runLoop({ greet: true })
  }

  function pause() {
    stopAll()
    dispatch({ type: 'pause' })
  }

  function resume() {
    stopAll()
    void runLoop({ greet: false, text: pendingText.current })
  }

  /** Ends the current listening turn now and sends what was heard so far. */
  function sendNow() {
    listening.current?.stop()
  }

  /** Cuts the assistant's speech short; the loop carries on to listening (or hand-off). */
  function skipSpeech() {
    stopSpeaking()
  }

  function retry() {
    if (state.errorKind === 'handoff') void handoff()
    else if (state.errorKind === 'api') resume()
    else void runLoop({ greet: false })
  }

  useEffect(() => {
    const refresh = () => setVoiceNote(voiceStatus(speechLocale(latest.current.language)))
    window.speechSynthesis?.addEventListener?.('voiceschanged', refresh)
    start()
    return () => {
      window.speechSynthesis?.removeEventListener?.('voiceschanged', refresh)
      stopAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Switching language mid-session: no new greeting. If the mic is open, reopen it in the new locale.
  useEffect(() => {
    if (previousLanguage.current === language) return
    previousLanguage.current = language
    setVoiceNote(voiceStatus(speechLocale(language)))
    if (phase.current === 'listening') {
      stopAll()
      void runLoop({ greet: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  return { state, voiceNote, supported, pause, resume, retry, handoff, sendNow, skipSpeech, alert, dismissAlert: () => setAlert(null) }
}
