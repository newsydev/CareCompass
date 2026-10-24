import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CaregiverCard } from '../components/CaregiverCard'
import { ChatBubble } from '../components/ChatBubble'
import { EmergencyBanner } from '../components/EmergencyBanner'
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
import type { Booking, ConversationTurn, TriageResponse } from '../api/types'

type ServiceExample = { label: string; example: string; recipient: 'self' | 'other' }
const SERVICE_EXAMPLES: Record<UiLanguage, ServiceExample[]> = {
  en: [
    { label: 'Home checkup', example: 'I have had a fever for two days and need a home checkup.', recipient: 'self' },
    { label: 'Nursing at home', example: 'My mother needs a nurse at home for wound dressing.', recipient: 'other' },
    { label: 'Lab test at home', example: 'I need a blood sample collected at home for a prescribed CBC test.', recipient: 'self' },
    { label: 'Doctor consultation', example: 'I would like a doctor consultation for a mild rash.', recipient: 'self' },
  ],
  hi: [
    { label: 'घर पर जांच', example: 'मुझे दो दिन से बुखार है, घर पर जांच चाहिए।', recipient: 'self' },
    { label: 'घर पर नर्सिंग', example: 'मेरी माँ को घाव की ड्रेसिंग के लिए घर पर नर्स चाहिए।', recipient: 'other' },
    { label: 'घर पर लैब टेस्ट', example: 'डॉक्टर ने CBC टेस्ट लिखा है, घर पर ब्लड सैंपल लेना है।', recipient: 'self' },
    { label: 'डॉक्टर से सलाह', example: 'हल्के रैश के लिए डॉक्टर से ऑनलाइन सलाह चाहिए।', recipient: 'self' },
  ],
}

const WELCOME: Record<UiLanguage, (name: string) => string> = {
  en: (name) => `Hi ${name}, welcome to CareCompass. How can we help you today? You can request a home checkup, nursing at home, a lab test, or a doctor consultation. For an emergency, call 112 or 102 now; this demo cannot dispatch an ambulance.`,
  hi: (name) => `नमस्ते ${name}, CareCompass में आपका स्वागत है। आज हम आपकी कैसे मदद करें? आप घर पर जांच, नर्सिंग, लैब टेस्ट या डॉक्टर से सलाह मांग सकते हैं। इमरजेंसी में तुरंत 112 या 102 पर कॉल करें; यह डेमो एम्बुलेंस नहीं भेज सकता।`,
}

function isEmergencyResponse(response: TriageResponse | null) {
  return response !== null && (response.red_flags.length > 0 || response.care_type === 'emergency_112' ||
    response.urgency === 'emergency' || response.assessment?.level === 'emergency')
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
  const [address, setAddress] = useState(profile.address)
  const [history, setHistory] = useState<ConversationTurn[]>(previousChat?.messages ?? [])
  const historyRef = useRef(history)
  const [input, setInput] = useState(() => previousChat?.messages.at(-1)?.role === 'user' ? previousChat.messages.at(-1)!.content : '')
  const [result, setResult] = useState<TriageResponse | null>(previousChat?.result ?? null)
  const [bookedCaregiverId, setBookedCaregiverId] = useState<string | null>(previousChat?.selectedCaregiverId ?? null)
  const [uiLanguage, setUiLanguage] = useUiLanguage()
  const t = STRINGS[uiLanguage]
  const [voiceLanguage, setVoiceLanguage] = useState(uiLanguage === 'hi' ? 'hi-IN' : 'en-IN')
  const [bookingTarget, setBookingTarget] = useState<string | null>(null)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [bookingBusy, setBookingBusy] = useState(false)
  const [bookingError, setBookingError] = useState<string | null>(null)
  const [autoRead, setAutoRead] = useState(false)
  const autoReadRef = useRef(false)
  const voice = useVoiceChat(setInput)
  const welcomeMessage = WELCOME[uiLanguage](profile.name)
  const conversationEnd = useRef<HTMLDivElement>(null)
  const emergencyPanel = useRef<HTMLDivElement>(null)

  const { location, isLocating, error: locationError, requestLocation } = useGeolocation(previousChat?.location ?? null)
  const triage = useTriage()
  const isPending = requestBusy || triage.isPending || saving
  const { data: caregivers } = useCaregivers()

  const isDecided = result !== null && result.follow_up_question === null
  const isEmergency = emergencyOpen || isEmergencyResponse(result)
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

  async function persist(messages: ConversationTurn[], emergency: boolean, nextResult = result, selectedCaregiver = bookedCaregiverId) {
    historyRef.current = messages
    setHistory(messages)
    const record = {
      id: activeChatId, messages, patientContext, recipient, emergency,
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
      setStorageError('This conversation could not be saved to the database. It remains visible here, but leaving this chat may lose these changes. Retry saving before leaving.')
    }
    return saved
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || submitting.current || isPending || voice.isListening) return
    if (recipient === 'self' && (/\b(?:(?:my|mere|meri|mera)\s+(?:mother|father|child|baby|son|daughter|wife|husband|grandmother|grandfather)|papa|mummy|dadi|dada)\b/i.test(text) || /(?:मेरी|मेरे|मेरा)\s*(?:माँ|मां|माता|पिता|पापा|मम्मी|बच्च|बेटा|बेटी|पत्नी|पति|दादी|दादा|नानी|नाना)/.test(text))) {
      setPatientError(history.length
        ? 'This message mentions another patient. Start a new chat so your medical profile is not applied to someone else.'
        : 'This message mentions another patient. Select "Someone else" above and enter their details instead of using your profile.')
      return
    }
    const validation = validatePatientContext(patientContext)
    setPatientError(validation)
    if (validation) return
    voice.stopSpeaking()
    voice.clearError()
    const lastTurn = history.at(-1)
    const priorHistory = lastTurn?.role === 'user' && lastTurn.content === text ? history.slice(0, -1) : history
    const pendingMessages: ConversationTurn[] = [...priorHistory, {
      role: 'user', content: text, patientContext, location: location ?? undefined,
    }]
    submitting.current = true
    setRequestBusy(true)
    if (!await persist(pendingMessages, emergencyRequested.current, null, null)) {
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
        language: uiLanguage === 'hi' ? 'hi' : 'auto',
        location,
        conversation_history: priorHistory.map(({ role, content }) => ({ role, content })),
        patient_context: patientContext,
      },
      {
        onSuccess: (response) => {
          const emergency = emergencyRequested.current || isEmergencyResponse(response)
          const supersededByEmergency = emergencyRequested.current && !isEmergencyResponse(response)
          const reply = supersededByEmergency
            ? 'You selected emergency assistance while the earlier request was being assessed. Call 112 or 102 now. No service has been contacted and no ambulance has been dispatched by this demo.'
            : describeResponse(response)
          const messages: ConversationTurn[] = [
            ...pendingMessages,
            { role: 'assistant', content: reply, result: supersededByEmergency ? undefined : response },
          ]
          emergencyRequested.current = emergency
          void persist(messages, emergency, supersededByEmergency ? null : response, null)
          if (emergency) setEmergencyOpen(true)
          setResult(supersededByEmergency ? null : response)
          setInput('')
          if (response.detected_language === 'hi' && voiceLanguage !== 'hi-IN') setVoiceLanguage('hi-IN')
          if (autoReadRef.current) {
            voice.speak(`reply-${messages.length - 1}`, reply, voiceLanguage)
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
    emergencyRequested.current = true
    setInput('I need emergency ambulance assistance.')
    setResult(null)
    setBookedCaregiverId(null)
    void persist(historyRef.current, true, null, null)
  }

  return (
    <div className="flex h-full overflow-hidden">
      <ChatSidebar chats={chats} activeId={activeChatId} onSelect={selectChat} onNew={startOver} disabled={isPending} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <section className="min-w-0 flex-1 overflow-y-auto bg-white" aria-label="Care conversation">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-gray-100 bg-white px-4 py-3">
          <button type="button" onClick={() => setSidebarOpen(true)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:hidden">Chat history</button>
          <h1 className="min-w-0 truncate text-sm font-semibold text-gray-700">{chats.find((chat) => chat.id === activeChatId)?.title ?? 'New care conversation'}</h1>
          <div className="flex shrink-0 items-center gap-2">
            <div role="group" aria-label={t.uiLanguage} className="flex overflow-hidden rounded-lg border border-gray-200 text-sm">
              {(['en', 'hi'] as const).map((code) => (
                <button key={code} type="button" aria-pressed={uiLanguage === code} onClick={() => {
                  setUiLanguage(code)
                  voice.stopSpeaking()
                  setVoiceLanguage(code === 'hi' ? 'hi-IN' : 'en-IN')
                }} className={`px-2.5 py-2 ${uiLanguage === code ? 'bg-brand-500 text-white' : 'bg-white text-gray-700'}`}>
                  {code === 'en' ? 'EN' : 'हिं'}
                </button>
              ))}
            </div>
            <button type="button" onClick={openEmergency} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{t.emergency}</button>
            <button type="button" onClick={startOver} disabled={isPending} className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50">{t.newChat}</button>
          </div>
        </div>
        <div className="mx-auto flex max-w-3xl flex-col px-4 py-5 sm:px-6">
      <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t.demoBanner}</p>
      {storageError && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{storageError}</p>}
      {storageError && <button type="button" disabled={saving} onClick={async () => {
        const record = unsavedChat.current
        if (record && await saveChat(record) && unsavedChat.current === record) {
          unsavedChat.current = null
          setStorageError(null)
        }
      }} className="mb-4 rounded-lg border border-red-200 px-3 py-2 text-sm">Retry saving conversation</button>}
      {saving && <p role="status" className="mb-3 text-xs text-gray-500">Saving conversation...</p>}

      <section className="mb-5 rounded-xl border border-gray-200 p-4" aria-label="Your details">
        <h2 className="font-semibold text-gray-900">
          {t.greeting(profile.name)}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Account: {profile.email} <Link to="/profile" className="ml-2 font-medium text-brand-600">Edit profile</Link>
        </p>
        <p className="mt-3 text-sm text-gray-700">
          {profile.address ? `Your address: ${profile.address}` : 'Add your care address below. Location sharing does not fill in your street address.'}
        </p>
        {profile && (
          <form
            className="mt-2 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              updateProfile({ ...profile, address: address.trim() })
            }}
          >
            <label className="min-w-0 flex-1 text-sm text-gray-600">
              Care address
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="street-address"
                placeholder="House number, street, city and postal code"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900"
              />
            </label>
            <button type="submit" className="self-end rounded-lg border border-gray-200 px-3 py-2 text-sm">
              Save address
            </button>
          </form>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isLocating}
            onClick={requestLocation}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm disabled:opacity-50"
          >
            {isLocating ? 'Finding your location...' : 'Use my current location'}
          </button>
          <p className="text-sm text-gray-500" role="status">
            {location
              ? `Shared coordinates (saved with this conversation): ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
              : 'Location not shared. You can still request care, but distances will not be based on your location.'}
          </p>
        </div>
        {locationError && (
          <div className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            <p role="alert">{locationError}</p>
            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block font-medium underline"
            >
              Open in a new tab
            </a>
            <p className="mt-1">
              If this stays in the embedded preview, copy this page's URL into Safari or Chrome.
              Log in with your account to access your saved profile in another browser.
            </p>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">
          Your address is saved in your account; it is not geocoded.
          Shared coordinates are saved with your conversation and used for nearby matching. Reopened chats reuse those coordinates; share your location again if it has changed.
        </p>
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
      {patientError && <p role="alert" className="mt-2 text-sm text-red-700">{patientError}</p>}

      {history.length === 0 && !result && (
        <section className="mb-4" aria-label="Choose a care service">
          <p className="text-sm text-gray-700">
            {t.howHelp(profile.name)} {t.chooseExample}
          </p>
          <div className="mt-3">
            <SpeechButton
              label="Read welcome and services aloud"
              isSpeaking={voice.speakingKey === 'welcome'}
              disabled={!voice.canSpeak || voice.isListening}
              onClick={() => voice.speak('welcome', welcomeMessage, voiceLanguage)}
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {SERVICE_EXAMPLES[uiLanguage].map((service) => (
              <button
                key={service.label}
                type="button"
                disabled={isPending || voice.isListening}
                onClick={() => {
                  setInput(service.example)
                  if (recipient !== service.recipient) {
                    setRecipient(service.recipient)
                    setPatientContext(patientContextFromProfile(service.recipient === 'self' ? profile : undefined))
                  }
                }}
                className="rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                <span className="block text-sm font-medium text-gray-900">{service.label}</span>
                <span className="mt-1 block text-xs text-gray-500">{service.example}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={openEmergency}
              className="rounded-lg border border-red-300 bg-red-50 p-3 text-left text-red-800 hover:bg-red-100 sm:col-span-2"
            >
              <span className="block text-sm font-semibold">{t.emergency}</span>
              <span className="mt-1 block text-xs">Call 112 / 102 now. View demo ambulance and hospital preferences; no dispatch or availability is confirmed.</span>
            </button>
          </div>
        </section>
      )}

      <div className="flex flex-1 flex-col gap-3">
        {history.map((turn, i) => isDecided && i === resultTurnIndex ? null : (
          <ChatBubble
            key={i}
            role={turn.role}
            content={turn.content}
            onReadAloud={() => voice.speak(`reply-${i}`, turn.content, voiceLanguage)}
            isSpeaking={voice.speakingKey === `reply-${i}`}
            speechDisabled={!voice.canSpeak || voice.isListening}
          />
        ))}

        {requestBusy && (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
              {t.thinking}
            </p>
          </div>
        )}

        {triage.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            CareCompass could not complete this request. Your message is saved; review the details and try Send again. {triage.error.message}
          </div>
        )}
        {!isPending && !triage.isError && history.at(-1)?.role === 'user' && (
          <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">The last request has no saved reply. Review the message below and send it again to retry.</p>
        )}

        {isEmergency && (
          <div ref={emergencyPanel} className="flex scroll-mt-16 flex-col gap-3">
            <EmergencyBanner redFlags={isEmergencyResponse(result) ? result!.red_flags : []} reasoning={isEmergencyResponse(result) ? result!.reasoning : 'You requested emergency assistance. Call 112 or 102 now; no service has been contacted by this app.'} />
            <SpeechButton
              label="Read emergency guidance aloud"
              isSpeaking={voice.speakingKey === `reply-${resultTurnIndex}`}
              disabled={!voice.canSpeak || voice.isListening}
              onClick={() => voice.speak(`reply-${resultTurnIndex}`, isEmergencyResponse(result) ? describeResponse(result!) : 'Call 112 or 102 now for emergency assistance. This demo has not dispatched an ambulance or contacted a hospital.', voiceLanguage)}
            />
            <EmergencyAssistance location={location} address={profile.address} disabled={isPending} onRecord={(summary) => {
              void persist([...history, { role: 'user', content: 'Record demo ambulance and hospital preferences' }, { role: 'assistant', content: summary }], true, null, null)
              setResult(null)
            }} />
            {result?.assessment && <AssessmentCard assessment={result.assessment} />}
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
              label="Read care recommendation aloud"
              isSpeaking={voice.speakingKey === `reply-${resultTurnIndex}`}
              disabled={!voice.canSpeak || voice.isListening}
              onClick={() => voice.speak(`reply-${resultTurnIndex}`, describeResponse(result!), voiceLanguage)}
            />

            {result!.matching_note && (
              <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{result!.matching_note}</p>
            )}

            {result!.matched_caregivers.length > 0 && (
              <div className="mt-2 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-gray-500">{t.recommended}</h2>
                <p className="text-xs text-gray-500">{t.recommendedNote}</p>
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
            {bookingError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{bookingError}</p>}

            {result?.assessment && (
              <div className="mt-2">
                <AssessmentCard assessment={result.assessment} />
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <label className="flex items-center gap-2">
          Voice language
          <select
            value={voiceLanguage}
            disabled={voice.isListening}
            onChange={(e) => {
              voice.stopSpeaking()
              setVoiceLanguage(e.target.value)
            }}
            className="rounded-lg border border-gray-200 bg-white px-2 py-2"
          >
            <option value="en-IN">English / Hinglish</option>
            <option value="hi-IN">Hindi</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={autoRead}
            disabled={!voice.canSpeak}
            onChange={(e) => {
              autoReadRef.current = e.target.checked
              setAutoRead(e.target.checked)
              if (!e.target.checked) voice.stopSpeaking()
            }}
          />
          Read replies aloud
        </label>
        {voice.speakingKey && (
          <button type="button" onClick={voice.stopSpeaking} className="font-medium text-brand-600">
            Stop audio
          </button>
        )}
      </div>
      {voice.error && <p role="alert" className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{voice.error}</p>}
      {!voice.canSpeak && <p className="mt-2 text-sm text-gray-500">Read aloud is unavailable in this browser.</p>}

      {isDecided && (
        <button
          type="button"
          onClick={startOver}
          className="mt-6 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          {t.newRequest}
        </button>
      )}
        <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
          <div className="w-full text-xs text-gray-500">
            {voice.isListening ? (
              <p role="status" className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
                Listening... {voice.interimTranscript || 'Speak now, then press Stop mic to review your message.'}
              </p>
            ) : (
              <p>
                {voice.canListen
                  ? 'Press the mic to speak. Review the transcript, then press Send. Your browser may send audio to its speech service.'
                  : 'Voice input is unavailable in this preview. Open this URL in Chrome or Safari, or type below.'}
              </p>
            )}
          </div>
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
            aria-label="Your care request"
            placeholder={t.placeholder}
            className="min-h-[52px] w-full resize-none rounded-lg border border-gray-200 px-3.5 py-3 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 sm:w-auto sm:min-w-0 sm:flex-1"
          />
          <button
            type="button"
            aria-label={voice.isListening ? 'Stop microphone' : 'Start microphone'}
            aria-pressed={voice.isListening}
            disabled={!voice.canListen || isPending}
            onClick={() => voice.isListening ? voice.stopListening() : voice.startListening(input, voiceLanguage)}
            className={`inline-flex h-[52px] items-center gap-2 rounded-lg border px-3 text-sm font-medium disabled:opacity-50 ${voice.isListening ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
              {voice.isListening && <path d="m3 3 18 18" />}
            </svg>
            {voice.isListening ? 'Stop mic' : 'Mic'}
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isPending || voice.isListening}
            className="h-[52px] shrink-0 rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white transition hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t.send}
          </button>
        </form>
        <div ref={conversationEnd} />
        </div>
      </section>
    </div>
  )
}
