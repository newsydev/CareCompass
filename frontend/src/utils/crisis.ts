import type { CrisisInfo, Helpline } from '../api/types'

// Client-side fallback so the alert appears at once, even when the backend is slow or down.
// Deliberately conservative on idioms ("this headache is killing me") and eager on real intent.
const LATIN_PATTERNS: RegExp[] = [
  /\bsu+i*[cs]+i*d/, // suicide, suicidal, sucidal, sucide, suiside
  /\bkill(?:ing)?\s*my\s*self\b/,
  /\bkill(?:ing)?\s*myself\b/,
  /\b(?:end|ending|take|taking)\s+(?:my|my own)\s+life\b/,
  /\bend\s+it\s+all\b/,
  /\b(?:want|wanna|going)\s+(?:to\s+)?die\b/,
  /\bwant\s+to\s+be\s+dead\b/,
  /\bdo(?:n'?t|\s+not)\s+want\s+to\s+(?:live|be\s+alive)\b/,
  /\bbetter\s+off\s+dead\b/,
  /\b(?:hurt|harm)\s+(?:my\s*self|myself)\b/,
  /\bcut\s+my\s+(?:wrist|wrists|veins)\b/,
  /\bkhud\s*k(?:u|h)?shi\b/,
  /\bkhudkhushi\b/,
  /\b(?:aatma|atma)\s*hatya\b/,
  /\bm[ae]rn[ae]\s+ch[ae]h?t[aei]/, // marna chahta / chahti / chahte
  /\bmar\s*j[ae]+n?a\s+ch[ae]h?t[aei]/,
  /\bjaan\s+(?:de|dena|dedu|de\s*dunga|de\s*dungi)\b/,
  /\bapni\s+jaan\s+(?:le|lena|de)/,
  /\bjee?n[ae]\s+(?:ka\s+man\s+nahi|nahi\s+ch[ae]h?t)/,
  /\bzindagi\s+khatm?\s*(?:kar|ho)/,
]

const HINDI_PHRASES = [
  'आत्महत्या', 'खुदकुशी', 'खुद्कुशी', 'मरना चाहता', 'मरना चाहती', 'मर जाना चाहता', 'मर जाना चाहती',
  'जान दे दूँगा', 'जान दे दूंगा', 'जान दे दूँगी', 'जान दे दूंगी', 'जान दे दू', 'अपनी जान',
  'जीना नहीं चाहता', 'जीना नहीं चाहती', 'जीने का मन नहीं', 'ज़िंदगी खत्म', 'जिंदगी खत्म', 'जिंदगी खतम',
]

function normalize(text: string) {
  return text.toLowerCase().replace(/[’‘`]/g, "'").replace(/[^\p{L}\p{M}\p{N}'\s]/gu, ' ').replace(/\s+/g, ' ').trim()
}

export function detectCrisis(text: string | null | undefined) {
  if (!text) return false
  const clean = normalize(text)
  return LATIN_PATTERNS.some((pattern) => pattern.test(clean)) || HINDI_PHRASES.some((phrase) => clean.includes(phrase))
}

export const DEFAULT_HELPLINES: Helpline[] = [
  { name: 'National emergency number', number: '112' },
  { name: 'Ambulance', number: '102' },
  { name: 'Tele-MANAS', number: '14416' },
  { name: 'KIRAN', number: '1800-599-0019' },
]

export const EMERGENCY_NUMBERS = ['112', '102']

/** Digits (and a leading +) only, safe for a tel: link. */
export function telHref(number: string) {
  return `tel:${number.replace(/[^\d+]/g, '')}`
}

/** 112 first, then everything else the backend sent (or our defaults), without repeats. */
export function crisisHelplines(crisis?: CrisisInfo | null): Helpline[] {
  const source = crisis?.helplines?.length ? crisis.helplines : DEFAULT_HELPLINES
  const seen = new Set<string>()
  return [{ name: 'National emergency number', number: '112' }, ...source].filter((line) => {
    const key = line.number.replace(/[^\d+]/g, '')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}
