import type { UiLanguage } from './i18n'

// Shared contract between the Consult picker, the chat (TriagePage) and the voice consultation.
// The chat language is chosen once ("Which language should we chat in?") and travels in ?lang=.
export const CONSULT_LANG_PARAM = 'lang'

export type ConsultKind = 'chat' | 'voice'

export function consultPath(language: UiLanguage, kind: ConsultKind = 'chat') {
  return `${kind === 'voice' ? '/consult/voice' : '/triage'}?${CONSULT_LANG_PARAM}=${language}`
}

export function readConsultLang(search: string): UiLanguage | null {
  const value = new URLSearchParams(search).get(CONSULT_LANG_PARAM)
  return value === 'hi' || value === 'en' ? value : null
}

/** Best guess for an older chat: Hindi if any message contains Devanagari. */
export function chatLanguage(chat: { messages: { content: string }[] }): UiLanguage {
  return chat.messages.some((turn) => /[ऀ-ॿ]/.test(turn.content)) ? 'hi' : 'en'
}

/** BCP-47 tag for browser speech recognition and synthesis. */
export function speechLocale(language: UiLanguage) {
  return language === 'hi' ? 'hi-IN' : 'en-IN'
}
