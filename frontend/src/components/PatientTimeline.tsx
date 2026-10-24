import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listBookings, cancelBooking } from '../api/bookings'
import type { Booking } from '../api/types'
import type { DemoChat } from '../utils/chatHistory'
import type { DemoProfile } from '../utils/demoProfile'
import { careLabel } from '../utils/i18n'
import { formatSlot } from '../utils/slots'

export interface TimelineEvent {
  id: string
  type: 'consultation' | 'booking' | 'emergency'
  timestamp: string
  title: string
  subtitle?: string
  status?: string
  urgency?: string
  careType?: string
  caregiverName?: string
  details?: string
  redFlags?: string[]
  isCancelled?: boolean
}

interface PatientTimelineProps {
  profile: DemoProfile
  chats: DemoChat[]
}

export function PatientTimeline({ profile, chats }: PatientTimelineProps) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [filter, setFilter] = useState<'all' | 'consultation' | 'booking' | 'emergency'>('all')
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    listBookings(controller.signal)
      .then((data) => setBookings(data))
      .catch((err) => console.warn('Could not load bookings for timeline:', err))
      .finally(() => setLoadingBookings(false))
    return () => controller.abort()
  }, [])

  async function handleCancel(bookingId: string) {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return
    setCancellingId(bookingId)
    try {
      const updated = await cancelBooking(bookingId)
      setBookings((prev) => prev.map((b) => (b.booking_id === bookingId ? updated : b)))
    } catch (err) {
      alert('Could not cancel booking: ' + String(err))
    } finally {
      setCancellingId(null)
    }
  }

  // Build unified chronological timeline
  const events: TimelineEvent[] = []

  // Add chat triage consultations
  chats.forEach((chat) => {
    const userFirstMsg = chat.messages.find((m) => m.role === 'user')?.content || chat.title || 'Care Consultation'
    const isEmerg = chat.emergency || (chat.result?.red_flags && chat.result.red_flags.length > 0)

    if (isEmerg) {
      events.push({
        id: `chat-emerg-${chat.id}`,
        type: 'emergency',
        timestamp: chat.updatedAt,
        title: 'Emergency Safety Protocol Activated',
        subtitle: `Reported symptoms: "${userFirstMsg.slice(0, 70)}${userFirstMsg.length > 70 ? '...' : ''}"`,
        redFlags: chat.result?.red_flags || ['Emergency Distress'],
        details: chat.result?.reasoning || 'Critical symptoms detected. Routine caregiver dispatch was blocked, and 112 emergency advice was provided.',
      })
    } else if (chat.result) {
      events.push({
        id: `chat-${chat.id}`,
        type: 'consultation',
        timestamp: chat.updatedAt,
        title: `Triage: ${chat.result.care_type ? careLabel(chat.result.care_type) : 'Clinical Review'}`,
        subtitle: `"${userFirstMsg.slice(0, 70)}${userFirstMsg.length > 70 ? '...' : ''}"`,
        urgency: chat.result.urgency || 'routine',
        careType: chat.result.care_type || undefined,
        details: chat.result.reasoning || chat.result.assessment?.summary || 'Clinical intake and caregiver evaluation completed.',
      })
    }
  })

  // Add bookings
  bookings.forEach((booking) => {
    events.push({
      id: `booking-${booking.booking_id}`,
      type: 'booking',
      timestamp: booking.created_at || booking.slot_start,
      title: `Home Care: ${careLabel(booking.care_type)}`,
      subtitle: `Caregiver: ${booking.caregiver_name || booking.caregiver_id}`,
      status: booking.status,
      caregiverName: booking.caregiver_name || booking.caregiver_id,
      careType: booking.care_type,
      urgency: booking.urgency || undefined,
      isCancelled: booking.status === 'cancelled',
      details: `Scheduled Slot: ${formatSlot(booking.slot_start)}. Status: ${booking.status === 'confirmed_demo' ? 'Confirmed (Demo)' : 'Cancelled'}. Booking Reference: ${booking.booking_id}.`,
    })
  })

  // Sort by newest timestamp first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Filter events
  const filteredEvents = filter === 'all' ? events : events.filter((e) => e.type === filter)

  // Stats
  const totalConsultations = events.filter((e) => e.type === 'consultation').length
  const totalBookings = events.filter((e) => e.type === 'booking' && !e.isCancelled).length
  const totalEmergencies = events.filter((e) => e.type === 'emergency').length

  function formatDate(iso: string) {
    try {
      const d = new Date(iso)
      return d.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return iso
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Patient Health Summary Card */}
      <div className="rounded-2xl border border-sky-100 bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white font-bold shadow-sm">
                {profile.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{profile.name}</h2>
                <p className="text-xs text-gray-500">
                  {profile.ageYears ? `${profile.ageYears} years old • ` : ''}
                  {profile.address || 'Address not provided'}
                </p>
              </div>
            </div>
            {profile.medicalHistory && (
              <div className="mt-3 flex items-start gap-1.5 text-xs text-slate-700 bg-white/70 rounded-lg p-2.5 border border-sky-100">
                <span className="font-semibold text-sky-800 shrink-0">Medical History:</span>
                <span className="line-clamp-2">{profile.medicalHistory}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs"
              title="Print official patient medical record"
            >
              <span>🖨️</span>
              <span>Export Record</span>
            </button>
            <Link
              to="/triage"
              className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition shadow-xs"
            >
              <span>💬</span>
              <span>New Triage Chat</span>
            </Link>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="mt-4 grid grid-cols-3 gap-2.5 pt-3 border-t border-sky-100/80">
          <div className="rounded-xl bg-white/80 p-2.5 text-center shadow-xs">
            <span className="text-lg font-bold text-sky-700">{totalConsultations}</span>
            <p className="text-[11px] font-medium text-gray-500">Triage Consults</p>
          </div>
          <div className="rounded-xl bg-white/80 p-2.5 text-center shadow-xs">
            <span className="text-lg font-bold text-emerald-700">{totalBookings}</span>
            <p className="text-[11px] font-medium text-gray-500">Active Visits</p>
          </div>
          <div className="rounded-xl bg-white/80 p-2.5 text-center shadow-xs">
            <span className="text-lg font-bold text-red-600">{totalEmergencies}</span>
            <p className="text-[11px] font-medium text-gray-500">Safety Intercepts</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
          <span>📈</span>
          <span>Longitudinal Medical Timeline</span>
        </h3>
        <div className="flex items-center gap-1">
          {(['all', 'consultation', 'booking', 'emergency'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition ${
                filter === tab
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab === 'all' ? 'All' : tab === 'consultation' ? 'Consults' : tab === 'booking' ? 'Visits' : 'Emergency'}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      {loadingBookings ? (
        <div className="py-8 text-center text-sm text-gray-500">Loading patient health record...</div>
      ) : filteredEvents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center">
          <p className="text-sm font-medium text-gray-600">No medical events in this category yet.</p>
          <p className="mt-1 text-xs text-gray-400">Start a care conversation to record symptoms and bookings.</p>
          <Link to="/triage" className="mt-3 inline-block rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-semibold text-white">
            Start Consultation
          </Link>
        </div>
      ) : (
        <div className="relative pl-6 sm:pl-8 space-y-6 before:absolute before:bottom-0 before:top-2 before:left-2 sm:before:left-3 before:w-0.5 before:bg-slate-200">
          {filteredEvents.map((evt) => {
            const isExpanded = expandedEventId === evt.id
            const isBooking = evt.type === 'booking'
            const isEmerg = evt.type === 'emergency'

            return (
              <div key={evt.id} className="relative group">
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-6 sm:-left-8 top-1 flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full ring-4 ring-white shadow-xs ${
                    isEmerg
                      ? 'bg-red-500 text-white text-xs'
                      : isBooking
                      ? evt.isCancelled
                        ? 'bg-gray-400 text-white text-xs'
                        : 'bg-emerald-500 text-white text-xs'
                      : 'bg-sky-600 text-white text-xs'
                  }`}
                >
                  {isEmerg ? '🚨' : isBooking ? (evt.isCancelled ? '✕' : '📅') : '🩺'}
                </div>

                {/* Event Card */}
                <div
                  className={`rounded-xl border transition-all ${
                    isEmerg
                      ? 'border-red-200 bg-red-50/50 hover:border-red-300'
                      : isBooking
                      ? evt.isCancelled
                        ? 'border-gray-200 bg-gray-50/60 opacity-75'
                        : 'border-emerald-200 bg-emerald-50/40 hover:border-emerald-300'
                      : 'border-slate-200 bg-white hover:border-sky-300 hover:shadow-xs'
                  } p-4`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 sm:gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900">{evt.title}</span>
                        {evt.urgency && (
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              evt.urgency === 'emergency'
                                ? 'bg-red-100 text-red-800'
                                : evt.urgency === 'same_day'
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {evt.urgency.replace('_', ' ')}
                          </span>
                        )}
                        {evt.status && (
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                              evt.status === 'confirmed_demo'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-gray-200 text-gray-700 line-through'
                            }`}
                          >
                            {evt.status === 'confirmed_demo' ? 'Confirmed' : 'Cancelled'}
                          </span>
                        )}
                      </div>
                      {evt.subtitle && <p className="mt-1 text-xs text-slate-600 italic">{evt.subtitle}</p>}
                    </div>

                    <time className="text-[11px] font-medium text-slate-400 shrink-0">
                      {formatDate(evt.timestamp)}
                    </time>
                  </div>

                  {/* Red flags badges */}
                  {evt.redFlags && evt.redFlags.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {evt.redFlags.map((flag) => (
                        <span key={flag} className="rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                          Critical Flag: {flag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Action / Toggle */}
                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                      className="font-medium text-sky-700 hover:text-sky-800 flex items-center gap-1"
                    >
                      <span>{isExpanded ? 'Hide clinical notes ▲' : 'View clinical notes ▼'}</span>
                    </button>

                    {isBooking && !evt.isCancelled && (
                      <button
                        type="button"
                        disabled={cancellingId === evt.id.replace('booking-', '')}
                        onClick={() => handleCancel(evt.id.replace('booking-', ''))}
                        className="text-[11px] font-medium text-red-600 hover:text-red-700 transition"
                      >
                        {cancellingId === evt.id.replace('booking-', '') ? 'Cancelling...' : 'Cancel Appointment'}
                      </button>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && evt.details && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-700 border border-slate-200/70">
                      <p className="font-semibold text-slate-800 mb-1">Clinical Intake & System Evaluation:</p>
                      <p className="whitespace-pre-line leading-relaxed">{evt.details}</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
