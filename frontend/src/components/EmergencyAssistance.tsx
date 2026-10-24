import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { getDemoHospitals } from '../api/careNavigation'
import { generateUUID } from '../utils/uuid'
import type { Location } from '../api/types'

interface EmergencyAssistanceProps {
  location: Location | null
  address: string
  onRecord: (summary: string) => void
  disabled: boolean
}

export function EmergencyAssistance({ location, address, onRecord, disabled }: EmergencyAssistanceProps) {
  const [pickup, setPickup] = useState(address)
  const [choice, setChoice] = useState('dispatcher')
  const [preferred, setPreferred] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const hospitals = useQuery({
    queryKey: ['demo-hospitals', location?.lat, location?.lng],
    queryFn: () => getDemoHospitals(location),
  })

  function createDemoRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!acknowledged || !pickup.trim() || (choice === 'preferred' && !preferred.trim())) return
    const hospital = hospitals.data?.find((item) => item.hospital_id === choice)
    const destination = choice === 'dispatcher'
      ? 'Dispatcher to choose an appropriate hospital; availability unknown'
      : choice === 'preferred' ? `Preferred hospital: ${preferred.trim()} (not verified)` : `${hospital?.name ?? 'Hospital preference not verified'} (fictional demo facility)`
    const text = `Demo ambulance request ${generateUUID().slice(0, 8)}\nPickup: ${pickup.trim()}\nDestination preference: ${destination}.\nNo ambulance has been dispatched, no hospital has accepted a patient, and no availability or ETA is confirmed. Call 112 or 102 now for real assistance.`
    setSummary(text)
    onRecord(text)
  }

  return (
    <section className="rounded-xl border border-red-200 bg-white p-5" aria-label="Demo ambulance and hospital preferences">
      <h2 className="text-lg font-semibold text-red-800">Ambulance and hospital preferences</h2>
      <p className="mt-2 text-sm font-semibold text-red-700">Demo only. Call 112 or 102 for real assistance. Do not wait to complete this form.</p>
      <p className="mt-2 text-sm text-gray-600">No live hospital directory, bed availability, ambulance dispatch, or booking service is connected. Hospital examples below are fictional, not actual nearby care facilities.</p>
      {hospitals.isPending && <p role="status" className="mt-3 text-sm text-gray-500">Loading fictional hospital examples...</p>}
      {hospitals.isError && <p role="alert" className="mt-3 text-sm text-red-700">Could not load hospital examples. You can still record a preferred hospital; no availability can be verified.</p>}
      <ul className="mt-3 space-y-2 text-sm text-gray-700">
        {hospitals.data?.map((hospital) => (
          <li key={hospital.hospital_id} className="rounded-lg border border-gray-100 p-3">
            <span className="font-medium">{hospital.name}</span> - availability unknown
            <span className="mt-1 block text-xs text-gray-500">
              {hospital.area}. {hospital.distance_km === null
                ? 'Distance unknown: location not shared.'
                : `Illustrative distance to a fictional point: ${hospital.distance_km} km. Not a real destination.`}
            </span>
          </li>
        ))}
      </ul>
      <form onSubmit={createDemoRequest} className="mt-4 text-sm text-gray-700">
        <fieldset disabled={disabled} className="flex flex-col gap-3">
        <label>Pickup address (demo)
          <input required maxLength={500} value={pickup} onChange={(e) => { setPickup(e.target.value); setSummary(null) }} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
        </label>
        <label>Hospital preference
          <select value={choice} onChange={(e) => { setChoice(e.target.value); setSummary(null) }} className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2">
            <option value="dispatcher">Dispatcher chooses appropriate hospital (availability unknown)</option>
            <option value="preferred">Enter my preferred hospital</option>
            {hospitals.data?.map((hospital) => <option key={hospital.hospital_id} value={hospital.hospital_id}>{hospital.name} (fictional, availability unknown)</option>)}
          </select>
        </label>
        {choice === 'preferred' && (
          <label>Preferred hospital name
            <input required maxLength={200} value={preferred} onChange={(e) => { setPreferred(e.target.value); setSummary(null) }} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2" />
          </label>
        )}
        <label className="flex items-start gap-2">
          <input required type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-1" />
          I understand this only records a demo preference and does not book or dispatch an ambulance.
        </label>
        <button type="submit" disabled={!acknowledged || !pickup.trim() || (choice === 'preferred' && !preferred.trim())} className="rounded-lg border border-red-300 bg-red-50 px-3 py-3 font-semibold text-red-800 disabled:opacity-50">Create demo ambulance request</button>
        </fieldset>
      </form>
      {summary && <p role="status" className="mt-4 whitespace-pre-line rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{summary}</p>}
    </section>
  )
}
