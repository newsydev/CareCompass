import { useState } from 'react'
import { accountError } from '../api/accounts'
import { createBooking } from '../api/bookings'
import type { Booking, CaregiverMatch, CaregiverProfile } from '../api/types'
import { STRINGS, type UiLanguage } from '../utils/i18n'
import { bookingSlots, formatSlot } from '../utils/slots'

interface BookingPanelProps {
  match: CaregiverMatch
  profile: CaregiverProfile | undefined
  careType: string
  urgency: string | null
  chatId: string
  language: UiLanguage
  onBooked: (booking: Booking) => void
  onClose: () => void
}

export function BookingPanel({ match, profile, careType, urgency, chatId, language, onBooked, onClose }: BookingPanelProps) {
  const t = STRINGS[language]
  const locale = language === 'hi' ? 'hi-IN' : 'en-IN'
  const slots = match.next_available && profile ? bookingSlots(match.next_available, profile.free_from, profile.free_until) : []
  const [slot, setSlot] = useState(slots[0] ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    if (!slot || busy) return
    setBusy(true)
    setError(null)
    try {
      onBooked(await createBooking({ caregiver_id: match.caregiver_id, care_type: careType, urgency, slot_start: slot, chat_id: chatId }))
    } catch (failure) {
      setError(accountError(failure))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4" role="group" aria-label={t.chooseSlot}>
      <p className="text-sm font-semibold text-gray-900">{profile?.name ?? match.caregiver_id}</p>
      {slots.length === 0 ? (
        <p className="mt-2 text-sm text-gray-600">No open slot could be calculated for this caregiver.</p>
      ) : (
        <label className="mt-2 block text-sm text-gray-700">
          {t.chooseSlot}
          <select value={slot} onChange={(e) => setSlot(e.target.value)} disabled={busy} className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
            {slots.map((value) => <option key={value} value={value}>{formatSlot(value, locale)}</option>)}
          </select>
        </label>
      )}
      <p className="mt-2 text-xs text-gray-500">{t.notContacted}</p>
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={confirm} disabled={!slot || busy} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {busy ? t.booking : t.confirm}
        </button>
        <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">{t.close}</button>
      </div>
    </div>
  )
}

export function BookingConfirmation({ booking, language, onCancel, cancelling }: { booking: Booking; language: UiLanguage; onCancel: () => void; cancelling: boolean }) {
  const t = STRINGS[language]
  const active = booking.status === 'confirmed_demo'
  return (
    <div role="status" className={`rounded-lg border p-4 text-sm ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
      <p className="font-semibold">{active ? t.confirmed : t.cancelled}: {booking.booking_id}</p>
      <p className="mt-1">
        {formatSlot(booking.slot_start, language === 'hi' ? 'hi-IN' : 'en-IN')} · {booking.caregiver_name ?? booking.caregiver_id} {t.bookingFor === 'with' ? '' : t.bookingFor}
      </p>
      <p className="mt-1 text-xs">{t.notContacted}</p>
      {active && (
        <button type="button" onClick={onCancel} disabled={cancelling} className="mt-2 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-50">
          {t.cancel}
        </button>
      )}
    </div>
  )
}
