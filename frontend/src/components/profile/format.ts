export const GENDERS = ['male', 'female', 'other', 'prefer_not'] as const
export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const

export function displayValue(value: string | number | null | undefined, empty = '-') {
  if (value === null || value === undefined) return empty
  const text = String(value).trim()
  return text || empty
}

/** True for a real calendar date written as YYYY-MM-DD that is not in the future. */
export function isValidDob(value: string, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false
  return date.getTime() <= now.getTime() && year >= 1900
}

/** Whole years, one decimal for under 2 years (matches the backend's decimal ageYears). */
export function ageFromDob(value: string, now = new Date()): number | undefined {
  if (!isValidDob(value, now)) return undefined
  const [year, month, day] = value.split('-').map(Number)
  let years = now.getUTCFullYear() - year
  if (now.getUTCMonth() + 1 < month || (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)) years -= 1
  if (years >= 2) return years
  const months = (now.getUTCFullYear() - year) * 12 + (now.getUTCMonth() + 1 - month) - (now.getUTCDate() < day ? 1 : 0)
  return Math.round((months / 12) * 10) / 10
}

export function formatDob(value: string | undefined, locale = 'en-IN') {
  if (!value || !isValidDob(value)) return '-'
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

export function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || '?'
}
