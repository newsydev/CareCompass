// All caregiver windows are IST; slots are emitted as ISO strings with the +05:30 offset.
const IST_OFFSET = '+05:30'

function toMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function hhmm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function nextDate(date: string) {
  const next = new Date(`${date}T00:00:00Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next.toISOString().slice(0, 10)
}

export function bookingSlots(nextAvailable: string, freeFrom: string, freeUntil: string, perDay = 6) {
  const date = nextAvailable.slice(0, 10)
  const first = toMinutes(nextAvailable.slice(11, 16))
  const start = toMinutes(freeFrom)
  const last = toMinutes(freeUntil) - 30
  const slots: string[] = []
  const add = (day: string, from: number) => {
    let count = 0
    for (let minute = Math.ceil(from / 30) * 30; minute <= last && count < perDay; minute += 30, count++) {
      slots.push(`${day}T${hhmm(minute)}${IST_OFFSET}`)
    }
  }
  add(date, Math.max(first, start))
  add(nextDate(date), start)
  return [...new Set(slots)]
}

export function formatSlot(iso: string, locale = 'en-IN') {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso))
}
