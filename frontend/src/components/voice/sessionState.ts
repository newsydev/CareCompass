import type { TriageResponse } from '../../api/types'

// Pure helpers for the hands-free voice consultation. No React or browser APIs, so they are unit-tested directly.

export type VoicePhase = 'idle' | 'greeting' | 'listening' | 'thinking' | 'speaking' | 'error' | 'done'
export type VoiceErrorKind = 'mic' | 'network' | 'api' | 'handoff'
export type VoiceLanguage = 'en' | 'hi'

export interface VoiceState {
  phase: VoicePhase
  transcript: string
  reply: string
  final: boolean
  errorKind: VoiceErrorKind | null
  errorMessage: string
  /** 'noSpeech' after the mic heard nothing for several turns, so the page can say so instead of idling silently. */
  notice: '' | 'noSpeech'
}

export type VoiceAction =
  | { type: 'greet'; text: string }
  | { type: 'listen' }
  | { type: 'silence' }
  | { type: 'interim'; text: string }
  | { type: 'heard'; text: string }
  | { type: 'reply'; text: string; final: boolean }
  | { type: 'pause' }
  | { type: 'handoff' }
  | { type: 'fail'; kind: VoiceErrorKind; message: string }

export const initialVoiceState: VoiceState = {
  phase: 'idle', transcript: '', reply: '', final: false, errorKind: null, errorMessage: '', notice: '',
}

export function voiceReducer(state: VoiceState, action: VoiceAction): VoiceState {
  switch (action.type) {
    case 'greet':
      return { ...initialVoiceState, phase: 'greeting', reply: action.text }
    case 'listen':
      return { ...state, phase: 'listening', transcript: '', errorKind: null, errorMessage: '', notice: '' }
    case 'silence':
      return state.phase === 'done' ? state : { ...state, phase: 'idle', notice: 'noSpeech' }
    case 'interim':
      return state.phase === 'listening' ? { ...state, transcript: action.text } : state
    case 'heard':
      return { ...state, phase: 'thinking', transcript: action.text, errorKind: null, errorMessage: '' }
    case 'reply':
      return { ...state, phase: 'speaking', reply: action.text, final: action.final }
    case 'pause':
      return state.phase === 'done' ? state : { ...state, phase: 'idle' }
    case 'handoff':
      return { ...state, phase: 'done', errorKind: null, errorMessage: '' }
    case 'fail':
      return { ...state, phase: 'error', errorKind: action.kind, errorMessage: action.message }
  }
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || ''
}

export function greetingText(name: string, language: VoiceLanguage) {
  const who = firstName(name)
  return language === 'hi'
    ? `नमस्ते${who ? ` ${who}` : ''}, मैं आपका CareCompass सहायक हूँ। आपको क्या तकलीफ़ है?`
    : `Hi${who ? ` ${who}` : ''}, I'm your CareCompass assistant. What problem are you facing today?`
}

export function isEmergencyResponse(response: TriageResponse | null) {
  return response !== null && (response.red_flags.length > 0 || response.care_type === 'emergency_112' ||
    response.urgency === 'emergency' || response.assessment?.level === 'emergency')
}

function isFollowUp(response: TriageResponse) {
  return response.action === 'ask_followup' && (response.questions?.length ?? 0) > 0
}

function isInformational(response: TriageResponse) {
  return response.action === 'answer' && !response.care_type && !response.assessment && !response.follow_up_question
}

/** Same rule as the chat page: a recommendation exists and nothing more is being asked. */
export function isDecidedResponse(response: TriageResponse) {
  return response.follow_up_question === null && !isFollowUp(response) && !isInformational(response)
}

/** Question text plus a short read-out of up to four options, so the user knows what they can say. */
export function followUpSpeech(response: TriageResponse, language: VoiceLanguage, describe: (r: TriageResponse, l: VoiceLanguage) => string) {
  const base = describe(response, language)
  const options = (response.questions?.[0]?.options ?? []).slice(0, 4).map((option) => option.label).filter(Boolean)
  if (!options.length) return base
  return `${base} ${language === 'hi' ? 'विकल्प' : 'Options'}: ${options.join(', ')}.`
}

export interface SpokenReply {
  text: string
  /** True when the conversation should move to the chat screen after this is spoken. */
  final: boolean
  emergency: boolean
}

export function spokenReply(
  response: TriageResponse,
  language: VoiceLanguage,
  describe: (r: TriageResponse, l: VoiceLanguage) => string,
): SpokenReply {
  if (isEmergencyResponse(response)) {
    return {
      emergency: true, final: true,
      text: language === 'hi'
        ? 'तुरंत 112 या 102 पर कॉल करें। इस ऐप ने किसी सेवा से संपर्क नहीं किया है। अब चैट खुल रही है।'
        : 'Call 112 or 102 now. This app has not contacted any service. Opening the chat now.',
    }
  }
  if (isFollowUp(response)) return { emergency: false, final: false, text: followUpSpeech(response, language, describe) }
  if (isDecidedResponse(response)) {
    const first = describe(response, language).split('\n')[0]
    return {
      emergency: false, final: true,
      text: `${first} ${language === 'hi' ? 'विवरण और डॉक्टर या नर्स के विकल्प चैट में देखें।' : 'Opening the chat for details and caregiver options.'}`,
    }
  }
  return { emergency: false, final: false, text: describe(response, language) }
}

export function phaseLabelKey(phase: VoicePhase) {
  return phase === 'greeting' ? 'speaking' : phase
}
