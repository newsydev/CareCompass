import type { UiLanguage } from '../../utils/i18n'

/** Speech locale decided per message: Devanagari reads as Hindi, everything else as English. */
export function messageSpeechLocale(text: string): 'hi-IN' | 'en-IN' {
  return /[ऀ-ॿ]/.test(text) ? 'hi-IN' : 'en-IN'
}

export const QUICK_REPLIES: Record<UiLanguage, string[]> = {
  en: ['I have a headache', "I'm feeling feverish", 'I have chest pain', 'I feel nauseous'],
  hi: ['मुझे सिरदर्द है', 'मुझे बुखार जैसा लग रहा है', 'मेरे सीने में दर्द है', 'मुझे उल्टी जैसा लग रहा है'],
}
