const EMAIL_KEY = 'carecompass.demo.email'
const NAME_PREFIX = 'carecompass.demo.name:'
const ADDRESS_PREFIX = 'carecompass.demo.address:'
const HISTORY_PREFIX = 'carecompass.demo.history:'
const AGE_PREFIX = 'carecompass.demo.age:'
const PREGNANCY_PREFIX = 'carecompass.demo.pregnant:'
const IMMUNITY_PREFIX = 'carecompass.demo.immunity:'
const CHAT_PREFIX = 'carecompass.demo.active-chat:'

export interface DemoProfile {
  email: string
  name: string
  address: string
  ageYears?: number
  medicalHistory: string
  pregnant: boolean
  immunocompromised: boolean
}

export function saveDemoIdentity(email: string, name?: string) {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail || !normalizedEmail.includes('@')) throw new Error('Enter a valid demo email.')
  sessionStorage.setItem(EMAIL_KEY, normalizedEmail)
  if (name?.trim()) {
    sessionStorage.setItem(`${NAME_PREFIX}${normalizedEmail}`, name.trim())
  }
}

export function getDemoProfile(): DemoProfile | null {
  const email = sessionStorage.getItem(EMAIL_KEY)
  if (!email) return null
  return getLegacyProfile(email)
}

export function getLegacyProfile(email: string): DemoProfile {
  const emailName = email.split('@')[0].replace(/[._-]+/g, ' ')
  const name = sessionStorage.getItem(`${NAME_PREFIX}${email}`) ||
    emailName.charAt(0).toUpperCase() + emailName.slice(1)

  const age = sessionStorage.getItem(`${AGE_PREFIX}${email}`)
  return {
    email,
    name,
    address: sessionStorage.getItem(`${ADDRESS_PREFIX}${email}`) ?? '',
    ageYears: age ? Number(age) : undefined,
    medicalHistory: sessionStorage.getItem(`${HISTORY_PREFIX}${email}`) ?? '',
    pregnant: sessionStorage.getItem(`${PREGNANCY_PREFIX}${email}`) === 'true',
    immunocompromised: sessionStorage.getItem(`${IMMUNITY_PREFIX}${email}`) === 'true',
  }

}

export function saveDemoProfile(profile: DemoProfile) {
  if (!profile.name.trim()) throw new Error('Enter a profile name.')
  if (profile.ageYears !== undefined && (!Number.isFinite(profile.ageYears) || profile.ageYears < 0 || profile.ageYears > 120)) {
    throw new Error('Profile age must be between 0 and 120 years.')
  }
  saveDemoIdentity(profile.email, profile.name)
  saveDemoAddress(profile.email, profile.address)
  sessionStorage.setItem(`${AGE_PREFIX}${profile.email}`, profile.ageYears === undefined ? '' : String(profile.ageYears))
  sessionStorage.setItem(`${HISTORY_PREFIX}${profile.email}`, profile.medicalHistory.trim())
  sessionStorage.setItem(`${PREGNANCY_PREFIX}${profile.email}`, String(profile.pregnant))
  sessionStorage.setItem(`${IMMUNITY_PREFIX}${profile.email}`, String(profile.immunocompromised))
}

export function getActiveChatId(email: string) {
  return sessionStorage.getItem(`${CHAT_PREFIX}${email}`)
}

export function setActiveChatId(email: string, id: string) {
  sessionStorage.setItem(`${CHAT_PREFIX}${email}`, id)
}

export function clearDemoIdentity() {
  const email = sessionStorage.getItem(EMAIL_KEY)
  if (email) sessionStorage.removeItem(`${CHAT_PREFIX}${email}`)
  sessionStorage.removeItem(EMAIL_KEY)
}

export function saveDemoAddress(email: string, address: string) {
  sessionStorage.setItem(`${ADDRESS_PREFIX}${email}`, address.trim())
}
