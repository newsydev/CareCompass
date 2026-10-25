import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { MenuItem } from '../components/chat/MenuItem'
import { QUICK_REPLIES, messageSpeechLocale } from '../components/chat/speechLang'
import { readConsultLang, speechLocale } from '../utils/consultLang'
import { CaregiverCard } from '../components/CaregiverCard'
import { ChatBubble } from '../components/ChatBubble'
import { EmergencyBanner } from '../components/EmergencyBanner'
import { EmergencyAlert } from '../components/emergency/EmergencyAlert'
import { emergencyStrings } from '../components/emergency/strings'
import { detectCrisis } from '../utils/crisis'
import { FollowUpQuestions } from '../components/FollowUpQuestions'
import { RecommendationCard } from '../components/RecommendationCard'
import { SpeechButton } from '../components/SpeechButton'
import { AssessmentCard } from '../components/AssessmentCard'
import { ChatSidebar } from '../components/ChatSidebar'
import { EmergencyAssistance } from '../components/EmergencyAssistance'
import { PatientContextForm } from '../components/PatientContextForm'
import { BookingConfirmation, BookingPanel } from '../components/BookingPanel'
import { accountError } from '../api/accounts'
import { cancelBooking, listBookings } from '../api/bookings'
import { STRINGS, careLabel, useUiLanguage, type UiLanguage } from '../utils/i18n'
import { formatSlot } from '../utils/slots'
import { useCaregivers } from '../hooks/useCaregivers'
import { useGeolocation } from '../hooks/useGeolocation'
import { useTriage } from '../hooks/useTriage'
import { useVoiceChat } from '../hooks/useVoiceChat'
import { useDemoSession } from '../hooks/useDemoSession'
import type { DemoProfile } from '../utils/demoProfile'
import type { DemoChat } from '../utils/chatHistory'
import { patientContextFromProfile, validatePatientContext } from '../utils/patientContext'
import { describeResponse } from '../utils/chatSummary'
import { ageHint, buildAnswers, composeAnswerText, draftFromAnswers, emptyDraft, isFollowUpResponse, isInformational, offTopicStreak, type Draft } from '../utils/followUp'
import { DoctorCaseSummary } from '../components/DoctorCaseSummary'
import { localizeMatchingNote } from '../utils/localizeNames'
import type { Booking, ConversationTurn, FollowUpAnswers, FollowUpQuestion, PatientContext, TriageResponse } from '../api/types'

function isEmergencyResponse(response: TriageResponse | null) {
  return response !== null && (response.red_flags.length > 0 || response.care_type === 'emergency_112' ||
    response.urgency === 'emergency' || response.assessment?.level === 'emergency' || Boolean(response.crisis))
}

export function TriagePage({ profile }: { profile: DemoProfile }) {
  const { activeChatId, chats, newChat, selectChat, updateProfile, saveChat, saving } = useDemoSession()
  const previousChat = chats.find((chat) => chat.id === activeChatId)
  const [storageError, setStorageError] = useState<string | null>(null)
  const unsavedChat = useRef<Omit<DemoChat, 'title' | 'updatedAt'> | null>(null)
  const [requestBusy, setRequestBusy] = useState(false)
  const submitting = useRef(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [patientContext, setPatientContext] = useState(() => previousChat?.patientContext ?? patientContextFromProfile(profile))
  const [recipient, setRecipient] = useState<'self' | 'other'>(previousChat?.recipient ?? 'self')
  const [patientError, setPatientError] = useState<string | null>(null)
  const [emergencyOpen, setEmergencyOpen] = useState(previousChat?.emergency ?? false)
  const emergencyRequested = useRef(previousChat?.emergency ?? false)
  const [dismissedAlert, setDismissedAlert] = useState<string | null>(null)
  const [address, setAddress] = useState(profile.address)
  const [history, setHistory] = useState<ConversationTurn[]>(previousChat?.messages ?? [])
  const historyRef = useRef(history)
  const [input, setInput] = useState(() => {
    const last = previousChat?.messages.at(-1)
    return last?.role === 'user' && !last.answers ? last.content : ''
  })
  const [result, setResult] = useState<TriageResponse | null>(previousChat?.result ?? null)
  const [bookedCaregiverId, setBookedCaregiverId] = useState<string | null>(previousChat?.selectedCaregiverId ?? null)
  const navigate = useNavigate()
  const routerLocation = useLocation()
  // A chat started from Consult has its language chosen once and locked for the whole conversation.
  const lockedLanguage = readConsultLang(routerLocation.search)
  const [storedLanguage, setUiLanguage] = useUiLanguage()
  const uiLanguage: UiLanguage = lockedLanguage ?? storedLanguage
  const t = STRINGS[uiLanguage]
  // The mic locale follows the chat language; a manual pick only applies to the language it was made in.
  const [voicePick, setVoicePick] = useState<{ language: UiLanguage; locale: string } | null>(null)
  const voiceLanguage = voicePick?.language === uiLanguage ? voicePick.locale : speechLocale(uiLanguage)
  const setVoiceLanguage = (locale: string) => setVoicePick({ language: uiLanguage, locale })
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (lockedLanguage) setUiLanguage(lockedLanguage)
  }, [lockedLanguage, setUiLanguage])
  const [bookingTarget, setBookingTarget] = useState<string | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [bookingBusy, setBookingBusy] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [autoRead, setAutoRead] = useState(false)
  const autoReadRef = useRef(false)
  const voice = useVoiceChat(setInput)
  const welcomeMessage = t.assistantGreeting(profile.name)
  // Each message is read in its own script, whatever the chat language is.
  const speakText = (key: string, text: string) => voice.speak(key, text, messageSpeechLocale(text))
  const conversationEnd = useRef<HTMLDivElement>(null)
  const emergencyPanel = useRef<HTMLDivElement>(null)

  const { location, isLocating, error: locationError, requestLocation } = useGeolocation(previousChat?.location ?? null)
  const triage = useTriage()
  const isPending = requestBusy || triage.isPending || saving
  const { data: caregivers } = useCaregivers()

  const isDecided = result !== null && result.follow_up_question === null && !isInformational(result)
  const isEmergency = emergencyOpen || isEmergencyResponse(result)
  // Crisis comes from the backend or, for speed and when it is down, from the patient's own words.
  const crisisInfo = result?.crisis ?? history.findLast((turn) => turn.result?.crisis)?.result?.crisis ?? null
  const crisisTurns = history.filter((turn) => turn.role === 'user' && detectCrisis(turn.content)).length
  const crisisActive = crisisTurns > 0 || crisisInfo !== null
  const alertKey = `${crisisTurns}:${crisisInfo ? 1 : 0}:${isEmergency ? 1 : 0}`
  const showAlert = (isEmergency || crisisActive) && dismissedAlert !== alertKey
  const lastTurn = history.at(-1)
  const followUpTurnIndex = lastTurn?.role === 'assistant' ? history.length - 1 : lastTurn?.answers ? history.length - 2 : -1
  const followUpResponse = followUpTurnIndex >= 0 ? history[followUpTurnIndex]?.result : undefined
  const pendingFollowUp = !emergencyOpen && isFollowUpResponse(followUpResponse) ? followUpResponse.questions : null
  const showShortcuts = history.length === 0 ? !result : offTopicStreak(history) >= 2
  const resultTurnIndex = history.findLastIndex((turn) => turn.role === 'assistant' && turn.result !== undefined)

  useEffect(() => {
    if (history.length) conversationEnd.current?.scrollIntoView({ block: 'end' })
  }, [history.length, result])

  useEffect(() => {
    const controller = new AbortController()
    listBookings(controller.signal)
      .then((items) => setBooking(items.filter((item) => item.chat_id === activeChatId).at(-1) ?? null))
      .catch(() => undefined)
    return () => controller.abort()
  }, [activeChatId])

  useEffect(() => {
    if (emergencyOpen) emergencyPanel.current?.scrollIntoView({ block: 'start' })
  }, [emergencyOpen])

  async function persist(messages: ConversationTurn[], emergency: boolean, nextResult = result, selectedCaregiver = bookedCaregiverId, context = patientContext) {
    historyRef.current = messages
    setHistory(messages)
    const record = {
      id: activeChatId, messages, patientContext: context, recipient, emergency,
      result: nextResult ?? undefined, location: location ?? undefined,
      selectedCaregiverId: selectedCaregiver ?? undefined,
    }
    unsavedChat.current = record
    const saved = await saveChat(record)
    if (unsavedChat.current !== record) return saved
    if (saved) {
      unsavedChat.current = null
      setStorageError(null)
    } else {
      setStorageError(t.saveFailed)
    }
    return saved
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || submitting.current || isPending || voice.isListening) return
    if (recipient === 'self' && (/\b(?:(?:my|mere|meri|mera)\s+(?:mother|father|child|baby|son|daughter|wife|husband|grandmother|grandfather)|papa|mummy|dadi|dada)\b/i.test(text) || /(?:मेरी|मेरे|मेरा)\s*(?:माँ|मां|माता|पिता|पापा|मम्मी|बच्च|बेटा|बेटी|पत्नी|पति|दादी|दादा|नानी|नाना)/.test(text))) {
      setPatientError(history.length
        ? t.otherPatientNew
        : t.otherPatientSelect)
      return
    }
    await send(text, undefined, patientContext)
  }

  // Answers from the follow-up card go out as a normal user turn, so safety and routing read them like typed text.
  function handleAnswers(questions: FollowUpQuestion[], draft: Draft) {
    if (submitting.current || isPending) return
    const hint = ageHint(questions, draft)
    const context = hint !== undefined && patientContext.age_years === undefined ? { ...patientContext, age_years: hint } : patientContext
    if (context !== patientContext) setPatientContext(context)
    void send(composeAnswerText(questions, draft), buildAnswers(questions, draft), context)
  }

  async function send(text: string, answers: FollowUpAnswers | undefined, context: PatientContext) {
    if (!text || submitting.current) return
    const validation = validatePatientContext(context)
    setPatientError(validation)
    if (validation) return
    voice.stopSpeaking()
    voice.clearError()
    if (detectCrisis(text)) {
      emergencyRequested.current = true
      setEmergencyOpen(true)
      setDismissedAlert(null)
    }
    const lastTurn = history.at(-1)
    const retrying = lastTurn?.role === 'user' && (lastTurn.content === text || (answers !== undefined && lastTurn.answers !== undefined))
    const priorHistory = retrying ? history.slice(0, -1) : history
    const pendingMessages: ConversationTurn[] = [...priorHistory, {
      role: 'user', content: text, patientContext: context, location: location ?? undefined, ...(answers ? { answers } : {}),
    }]
    submitting.current = true
    setRequestBusy(true)
    if (!await persist(pendingMessages, emergencyRequested.current, null, null, context)) {
      submitting.current = false
      setRequestBusy(false)
      return
    }
    setResult(null)
    setBookedCaregiverId(null)
    setBookingTarget(null)
    setBookingError(null)

    triage.mutate(
      {
        user_input: text,
        language: lockedLanguage ?? (uiLanguage === 'hi' ? 'hi' : 'auto'),
        location,
        conversation_history: priorHistory.map(({ role, content, follow_up_ids, answers: given }) => ({ role, content, follow_up_ids, answers: given })),
        patient_context: context,
        answers,
      },
      {
        onSuccess: (response) => {
          const emergency = emergencyRequested.current || isEmergencyResponse(response)
          const supersededByEmergency = emergencyRequested.current && !isEmergencyResponse(response)
          const detected = (response.detected_language || '').toLowerCase()
          const isHindi = lockedLanguage ? lockedLanguage === 'hi' : uiLanguage === 'hi' || detected === 'hindi' || detected === 'hi'
          if (!lockedLanguage && isHindi && uiLanguage !== 'hi') {
            setUiLanguage('hi')
          }
          const effectiveLang: UiLanguage = isHindi ? 'hi' : 'en'

          const reply = supersededByEmergency && detectCrisis(text)
            ? emergencyStrings(effectiveLang).crisisReply
            : supersededByEmergency
            ? (effectiveLang === 'hi'
                ? 'पिछली जांच के दौरान आपने आपातकालीन सहायता चुनी थी। तुरंत 112 या 102 पर कॉल करें। इस डेमो द्वारा किसी सेवा से संपर्क नहीं किया गया है।'
                : 'You selected emergency assistance while the earlier request was being assessed. Call 112 or 102 now. No service has been contacted and no ambulance has been dispatched by this demo.')
            : describeResponse(response, effectiveLang)
          const messages: ConversationTurn[] = [
            ...pendingMessages,
            {
              role: 'assistant', content: reply, result: supersededByEmergency ? undefined : response,
              ...(!supersededByEmergency && isFollowUpResponse(response) ? { follow_up_ids: response.questions.map((question) => question.question_id) } : {}),
            },
          ]
          emergencyRequested.current = emergency
          void persist(messages, emergency, supersededByEmergency ? null : response, null, context)
          if (emergency) setEmergencyOpen(true)
          setResult(supersededByEmergency ? null : response)
          setInput('')
          if (autoReadRef.current) {
            speakText(`reply-${messages.length - 1}`, reply)
          }
        },
        onSettled: () => {
          submitting.current = false
          setRequestBusy(false)
        },
      },
    )
  }

  async function handleCancelBooking() {
    if (!booking || bookingBusy) return
    setBookingBusy(true)
    setBookingError(null)
    try {
      const cancelled = await cancelBooking(booking.booking_id)
      setBooking(cancelled)
      setBookedCaregiverId(null)
      void persist([...historyRef.current, { role: 'assistant', content: `${t.cancelled}: ${cancelled.booking_id}.` }], false, result, null)
    } catch (failure) {
      setBookingError(accountError(failure))
    } finally {
      setBookingBusy(false)
    }
  }

  function startOver() {
    voice.cancelListening()
    voice.stopSpeaking()
    voice.clearError()
    newChat()
  }

  function openEmergency() {
    voice.cancelListening()
    voice.stopSpeaking()
    setEmergencyOpen(true)
    setDismissedAlert(null)
    emergencyRequested.current = true
    setInput('I need emergency ambulance assistance.')
    setResult(null)
    setBookedCaregiverId(null)
    void persist(historyRef.current, true, null, null)
  }

  const [detailsOpen, setDetailsOpen] = useState(false)
  const detailsVisible = detailsOpen || patientError !== null || locationError !== null

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white">
      <ChatSidebar chats={chats} activeId={activeChatId} onSelect={(id) => { selectChat(id); setSidebarOpen(false) }} onNew={() => { startOver(); setSidebarOpen(false) }} disabled={isPending} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <header className="relative z-30 flex shrink-0 items-center gap-2 border-b border-gray-100 bg-white px-4 py-2.5">
        <button
          type="button" onClick={() => { voice.cancelListening(); voice.stopSpeaking(); navigate('/consult') }}
          aria-label={t.chatBack}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-900 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight text-gray-900">{t.chatTitle}</h1>
          <p className="truncate text-sm font-medium text-emerald-700">{t.chatStatus}</p>
        </div>
        <div className="relative shrink-0">
          <button
            type="button" aria-haspopup="menu" aria-expanded={menuOpen} aria-label={t.chatMenuLabel}
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex min-h-11 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            {t.chatMenu}
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={menuOpen ? 'rotate-180' : ''}><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {menuOpen && (
            <>
              <button type="button" tabIndex={-1} aria-label={t.close} onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 cursor-default" />
              <div
                role="menu" aria-label={t.chatMenuLabel}
                onKeyDown={(e) => { if (e.key === 'Escape') setMenuOpen(false) }}
                className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-lg"
              >
                <MenuItem label={t.menuHistory} onSelect={() => { setMenuOpen(false); setSidebarOpen(true) }} />
                <MenuItem label={t.newChat} disabled={isPending} onSelect={() => { setMenuOpen(false); startOver() }} />
                <MenuItem label={t.emergency} danger onSelect={() => { setMenuOpen(false); openEmergency() }} />
                <MenuItem label={t.menuDetails} onSelect={() => { setMenuOpen(false); setDetailsOpen(!detailsVisible) }} />
                <button
                  type="button" role="menuitemcheckbox" aria-checked={autoRead} disabled={!voice.canSpeak}
                  onClick={() => {
                    const next = !autoRead
                    autoReadRef.current = next
                    setAutoRead(next)
                    if (!next) voice.stopSpeaking()
                  }}
                  className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-medium text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50"
                >
                  {t.menuReadAloud}
                  <span aria-hidden="true" className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${autoRead ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300'}`}>{autoRead ? '✓' : ''}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </header>
      <section className="min-h-0 flex-1 overflow-y-auto bg-white" aria-label={t.conversationLabel}>
        {showAlert && <EmergencyAlert key={alertKey} language={uiLanguage} crisis={crisisInfo ?? crisisActive} onDismiss={() => setDismissedAlert(alertKey)} />}
        <div className="flex min-h-full flex-col px-4 pt-3">
      <p className="mb-3 text-center text-xs text-gray-600">{t.demoBanner}</p>
      {storageError && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{storageError}</p>}
      {storageError && <button type="button" disabled={saving} onClick={async () => {
        const record = unsavedChat.current
        if (record && await saveChat(record) && unsavedChat.current === record) {
          unsavedChat.current = null
          setStorageError(null)
        }
      }} className="mb-3 min-h-11 rounded-xl border border-red-200 px-3 text-sm">{t.retrySave}</button>}

      {patientError && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{patientError}</p>}

      <div id="consult-details" hidden={!detailsVisible} className="mb-3">
      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm" aria-label={t.yourDetails}>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            updateProfile({ ...profile, address: address.trim() })
          }}
        >
          <label className="min-w-0 text-sm text-gray-600">
            {t.careAddress}
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              placeholder={t.addressPlaceholder}
              className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 px-3 py-2 text-base text-gray-900"
            />
          </label>
          <button type="submit" className="min-h-11 self-start rounded-xl border border-gray-200 px-4 text-sm">
            {t.saveAddress}
          </button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isLocating}
            onClick={requestLocation}
            className="min-h-11 rounded-xl border border-gray-200 px-3 text-sm disabled:opacity-50"
          >
            {isLocating ? t.findingLocation : t.useLocation}
          </button>
          {location && <p className="text-sm text-gray-500" role="status">{t.locationShared(location.lat.toFixed(4), location.lng.toFixed(4))}</p>}
        </div>
        {locationError && (
          <div className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
            <p role="alert">{locationError}</p>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-medium underline"
            >
              {t.openNewTab}
            </a>
          </div>
        )}
      </section>

      <PatientContextForm
        value={patientContext}
        onChange={(value) => { setPatientContext(value); setPatientError(null) }}
        recipient={recipient}
        onRecipientChange={(value) => {
          setRecipient(value)
          setPatientContext(patientContextFromProfile(value === 'self' ? profile : undefined))
          setPatientError(null)
        }}
        disabled={isPending || voice.isListening}
        recipientLocked={history.length > 0}
      />

      {!lockedLanguage && (
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-700">
          {t.voiceLanguageLabel}
          <select
            value={voiceLanguage}
            disabled={voice.isListening}
            onChange={(e) => {
              voice.stopSpeaking()
              setVoiceLanguage(e.target.value)
            }}
            className="min-h-11 rounded-xl border border-gray-200 bg-white px-2 text-base"
          >
            <option value="en-IN">{t.voiceLangEnglish}</option>
            <option value="hi-IN">{t.voiceLangHindi}</option>
          </select>
        </label>
      )}
      </div>

      {showShortcuts && (
        <section data-tour="chat-quick" className="mb-3" aria-label={t.quickRepliesLabel}>
          {history.length === 0 && (
            <div className="mb-3">
              <ChatBubble
                role="assistant"
                content={welcomeMessage}
                onReadAloud={() => speakText('welcome', welcomeMessage)}
                isSpeaking={voice.speakingKey === 'welcome'}
                speechDisabled={!voice.canSpeak || voice.isListening}
                readLabel={t.readAloud}
                stopLabel={t.stopAloud}
              />
            </div>
          )}
          <ol className="grid gap-2">
            {QUICK_REPLIES[uiLanguage].map((text, index) => (
              <li key={text}>
                <button
                  type="button"
                  disabled={isPending || voice.isListening}
                  onClick={() => { void send(text, undefined, patientContext) }}
                  className="flex min-h-16 w-full items-center gap-4 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-left text-lg text-gray-900 transition hover:border-brand-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50"
                >
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-lg text-gray-600">{index + 1}</span>
                  <span className="min-w-0 flex-1 break-words">{text}</span>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-gray-500"><path d="m9 18 6-6-6-6" /></svg>
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="flex flex-1 flex-col gap-3 pb-3">
        {history.map((turn, i) => isDecided && i === resultTurnIndex ? null : (
          <ChatBubble
            key={i}
            role={turn.role}
            content={turn.content}
            onReadAloud={() => speakText(`reply-${i}`, turn.content)}
            isSpeaking={voice.speakingKey === `reply-${i}`}
            speechDisabled={!voice.canSpeak || voice.isListening}
            readLabel={t.readAloud}
            stopLabel={t.stopAloud}
          />
        ))}

        {pendingFollowUp && (
          <FollowUpQuestions
            key={followUpTurnIndex}
            questions={pendingFollowUp}
            initialDraft={lastTurn?.answers ? draftFromAnswers(pendingFollowUp, lastTurn.answers) : emptyDraft(pendingFollowUp)}
            busy={isPending}
            failed={triage.isError}
            language={uiLanguage}
            onSubmit={(draft) => handleAnswers(pendingFollowUp, draft)}
          />
        )}

        {requestBusy && !pendingFollowUp && (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
              {t.thinking}
            </p>
          </div>
        )}

        {triage.isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {t.requestFailed(triage.error.message)}
          </div>
        )}
        {!isPending && !triage.isError && history.at(-1)?.role === 'user' && (
          <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t.noSavedReply}</p>
        )}

        {isEmergency && (
          <div ref={emergencyPanel} className="flex scroll-mt-16 flex-col gap-3">
            <EmergencyBanner
              redFlags={isEmergencyResponse(result) ? result!.red_flags : []}
              reasoning={isEmergencyResponse(result) ? result!.reasoning : crisisActive ? emergencyStrings(uiLanguage).crisisBody : (uiLanguage === 'hi' ? 'आपने आपातकालीन सहायता का अनुरोध किया है। तुरंत 112 या 102 पर कॉल करें; इस ऐप द्वारा किसी सेवा से संपर्क नहीं किया गया है।' : 'You requested emergency assistance. Call 112 or 102 now; no service has been contacted by this app.')}
              language={uiLanguage}
            />
            <SpeechButton
              label={uiLanguage === 'hi' ? 'आपातकालीन निर्देश सुनें' : 'Read emergency guidance aloud'}
              isSpeaking={voice.speakingKey === `reply-${resultTurnIndex}`}
              disabled={!voice.canSpeak || voice.isListening}
              onClick={() => speakText(`reply-${resultTurnIndex}`, isEmergencyResponse(result) ? describeResponse(result!, uiLanguage) : (uiLanguage === 'hi' ? 'आपातकालीन सहायता के लिए तुरंत 112 या 102 पर कॉल करें। इस डेमो ने किसी एम्बुलेंस को नहीं भेजा है।' : 'Call 112 or 102 now for emergency assistance. This demo has not dispatched an ambulance or contacted a hospital.'))}
            />
            <EmergencyAssistance location={location} address={profile.address} disabled={isPending} onRecord={(summary) => {
              void persist([...history, { role: 'user', content: 'Record demo ambulance and hospital preferences' }, { role: 'assistant', content: summary }], true, null, null)
              setResult(null)
            }} />
            {result?.assessment && <AssessmentCard assessment={result.assessment} language={uiLanguage} />}
          </div>
        )}

        {isDecided && !isEmergency && (
          <>
            {result!.care_type && <RecommendationCard
              careType={result!.care_type}
              urgency={result!.urgency}
              reasoning={result!.reasoning}
              language={uiLanguage}
            />}
            <SpeechButton
              label={uiLanguage === 'hi' ? 'सलाह सुनें' : 'Read care recommendation aloud'}
              isSpeaking={voice.speakingKey === `reply-${resultTurnIndex}`}
              disabled={!voice.canSpeak || voice.isListening}
              onClick={() => speakText(`reply-${resultTurnIndex}`, describeResponse(result!, uiLanguage))}
            />

            <DoctorCaseSummary
              response={result!}
              profile={profile}
              patientContext={patientContext}
              recipient={recipient}
              language={uiLanguage}
            />

            {result!.matching_note && (
              <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{localizeMatchingNote(result!.matching_note, uiLanguage)}</p>
            )}

            {result!.matched_caregivers.length > 0 && (
              <div className="mt-2 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-gray-500">{t.recommended}</h2>
                {result!.matched_caregivers.map((match) => {
                  const caregiverProfile = caregivers?.find((c) => c.caregiver_id === match.caregiver_id)
                  return (
                    <div key={match.caregiver_id} className="flex flex-col gap-2">
                      <CaregiverCard
                        caregiverId={match.caregiver_id}
                        matchScore={match.score}
                        matchReason={match.reason}
                        profile={caregiverProfile}
                        language={uiLanguage}
                        disabled={booking?.status === 'confirmed_demo' || !match.next_available || !result!.care_type}
                        onBook={() => {
                          setBookingTarget(match.caregiver_id)
                          setBookingError(null)
                        }}
                      />
                      {bookingTarget === match.caregiver_id && result!.care_type && (
                        <BookingPanel
                          match={match}
                          profile={caregiverProfile}
                          careType={result!.care_type}
                          urgency={result!.urgency}
                          chatId={activeChatId}
                          language={uiLanguage}
                          onClose={() => setBookingTarget(null)}
                          onBooked={(created) => {
                            setBooking(created)
                            setBookingTarget(null)
                            setBookedCaregiverId(created.caregiver_id)
                            void persist([...historyRef.current, {
                              role: 'assistant',
                              content: `${t.confirmed}: ${created.booking_id} — ${created.caregiver_name ?? created.caregiver_id}, ${careLabel(created.care_type, uiLanguage)}, ${formatSlot(created.slot_start, uiLanguage === 'hi' ? 'hi-IN' : 'en-IN')}. ${t.notContacted}`,
                            }], false, result, created.caregiver_id)
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {booking && (
              <BookingConfirmation booking={booking} language={uiLanguage} cancelling={bookingBusy} onCancel={handleCancelBooking} />
            )}
            {bookingError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{bookingError}</p>}

            {result?.assessment && (
              <div className="mt-2">
                <AssessmentCard assessment={result.assessment} language={uiLanguage} />
              </div>
            )}
          </>
        )}
      </div>

      {voice.speakingKey && (
        <button type="button" onClick={voice.stopSpeaking} className="mt-3 min-h-11 self-start font-medium text-brand-600">
          {t.stopAudio}
        </button>
      )}
      {voice.error && <p role="alert" className="mt-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{voice.error}</p>}

      {isDecided && (
        <button
          type="button"
          onClick={startOver}
          className="mt-4 min-h-11 self-start rounded-xl border border-gray-200 px-4 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          {t.newRequest}
        </button>
      )}
        <div ref={conversationEnd} />
        <form onSubmit={handleSubmit} className="sticky bottom-0 z-10 -mx-4 mt-3 flex items-center gap-2 border-t border-gray-100 bg-white px-4 py-2.5">
          {voice.isListening && (
            <p role="status" className="absolute inset-x-4 bottom-full mb-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-800 shadow-sm">
              <span className="font-semibold">{t.listening}</span> {voice.interimTranscript || t.listeningHint}
            </p>
          )}
          <textarea
            value={input}
            readOnly={voice.isListening}
            disabled={isPending}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            rows={1}
            aria-label={t.careRequestLabel}
            placeholder={t.placeholder}
            className="max-h-32 min-h-12 min-w-0 flex-1 resize-none rounded-3xl bg-gray-100 px-4 py-3 text-base text-gray-900 outline-none transition placeholder:text-gray-600 focus:ring-2 focus:ring-brand-500/40"
          />
          {input.trim() && (
            <button
              type="submit"
              aria-label={t.send}
              disabled={isPending || voice.isListening}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 active:bg-brand-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
            </button>
          )}
          <button
            type="button"
            data-tour="chat-mic"
            aria-label={voice.isListening ? t.micStop : t.micStart}
            aria-pressed={voice.isListening}
            disabled={!voice.canListen || isPending}
            onClick={() => voice.isListening ? voice.stopListening() : voice.startListening(input, voiceLanguage)}
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50 ${voice.isListening ? 'animate-pulse bg-red-700 ring-4 ring-red-200' : 'bg-brand-700 hover:bg-brand-800'}`}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
            </svg>
          </button>
        </form>
        </div>
      </section>
    </div>
  )
}
