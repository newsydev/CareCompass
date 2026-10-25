import type { Vitals } from '../api/types'
import { VITAL_FIELDS, validatePatientContext } from './patientContext'

export type VitalValues = Partial<Record<keyof Vitals, number>>
export interface VitalEntry { id: string; recordedAt: string; values: VitalValues }
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export const MAX_ENTRIES = 50
export const storageKey = (email: string) => `carecompass.vitals:${email.trim().toLowerCase()}`

function defaultStorage(): StorageLike | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

function cleanValues(raw: unknown): VitalValues {
  const out: VitalValues = {}
  if (!raw || typeof raw !== 'object') return out
  for (const f of VITAL_FIELDS) {
    const v = (raw as Record<string, unknown>)[f.key]
    if (typeof v === 'number' && Number.isFinite(v) && v >= f.min && v <= f.max) out[f.key] = v
  }
  return out
}

/** Entries are stored newest first. Invalid items are dropped. Never throws. */
export function loadEntries(email: string, storage: StorageLike | null = defaultStorage()): VitalEntry[] {
  try {
    const text = storage?.getItem(storageKey(email))
    if (!text) return []
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    const entries: VitalEntry[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const { id, recordedAt, values } = item as Record<string, unknown>
      if (typeof id !== 'string' || typeof recordedAt !== 'string' || Number.isNaN(Date.parse(recordedAt))) continue
      const clean = cleanValues(values)
      if (Object.keys(clean).length === 0) continue
      entries.push({ id, recordedAt, values: clean })
    }
    entries.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
    return entries.slice(0, MAX_ENTRIES)
  } catch {
    return []
  }
}

function save(email: string, entries: VitalEntry[], storage: StorageLike | null): void {
  try {
    if (!storage) return
    if (entries.length === 0) storage.removeItem(storageKey(email))
    else storage.setItem(storageKey(email), JSON.stringify(entries))
  } catch { /* storage blocked or full: keep working in memory */ }
}

/** Returns an error message, or null when the values can be saved. */
export function validateVitalValues(values: VitalValues): string | null {
  if (VITAL_FIELDS.every((f) => values[f.key] === undefined)) return 'Enter at least one value.'
  return validatePatientContext({ medical_history: '', pregnant: false, immunocompromised: false, vitals: values })
}

/** Parse text inputs; blank means unknown. NaN is kept so validation reports it. */
export function parseInputs(inputs: Partial<Record<keyof Vitals, string>>): VitalValues {
  const out: VitalValues = {}
  for (const f of VITAL_FIELDS) {
    const text = (inputs[f.key] ?? '').trim()
    if (text !== '') out[f.key] = Number(text)
  }
  return out
}

let counter = 0
export function addEntry(email: string, values: VitalValues, now: Date = new Date(), storage: StorageLike | null = defaultStorage()): VitalEntry[] {
  const clean = cleanValues(values)
  const current = loadEntries(email, storage)
  if (Object.keys(clean).length === 0) return current
  const entry: VitalEntry = { id: `${now.getTime().toString(36)}-${(counter++).toString(36)}`, recordedAt: now.toISOString(), values: clean }
  const next = [entry, ...current].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt)).slice(0, MAX_ENTRIES)
  save(email, next, storage)
  return next
}

export function removeEntry(email: string, id: string, storage: StorageLike | null = defaultStorage()): VitalEntry[] {
  const next = loadEntries(email, storage).filter((e) => e.id !== id)
  save(email, next, storage)
  return next
}

export function clearEntries(email: string, storage: StorageLike | null = defaultStorage()): VitalEntry[] {
  save(email, [], storage)
  return []
}

export interface LatestMeasure { key: keyof Vitals | 'blood_pressure'; label: string; value: string; unit: string; recordedAt: string }

/** Latest recorded value of each measure (entries may omit measures). BP needs both numbers from one entry. */
export function latestByMeasure(entries: VitalEntry[]): LatestMeasure[] {
  const sorted = [...entries].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
  const find = <T,>(pick: (e: VitalEntry) => T | undefined) => {
    for (const e of sorted) { const r = pick(e); if (r !== undefined) return { r, at: e.recordedAt } }
    return null
  }
  const out: LatestMeasure[] = []
  const simple: [keyof Vitals, string, string][] = [
    ['temperature_c', 'Temperature', '°C'],
    ['oxygen_percent', 'Oxygen saturation', '%'],
    ['heart_rate', 'Heart rate', 'bpm'],
  ]
  for (const [key, label, unit] of simple) {
    const hit = find((e) => e.values[key])
    if (hit) out.push({ key, label, value: String(hit.r), unit, recordedAt: hit.at })
  }
  const bp = find((e) => {
    const { systolic_bp: s, diastolic_bp: d } = e.values
    return s !== undefined && d !== undefined ? `${s}/${d}` : undefined
  })
  if (bp) out.push({ key: 'blood_pressure', label: 'Blood pressure', value: bp.r, unit: 'mmHg', recordedAt: bp.at })
  const rr = find((e) => e.values.respiratory_rate)
  if (rr) out.push({ key: 'respiratory_rate', label: 'Respiratory rate', value: String(rr.r), unit: 'br/min', recordedAt: rr.at })
  return out
}

export function formatRecordedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}
