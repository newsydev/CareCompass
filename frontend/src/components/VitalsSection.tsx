import { useEffect, useMemo, useRef, useState } from 'react'
import type { Vitals } from '../api/types'
import { VITAL_FIELDS } from '../utils/patientContext'
import {
  addEntry, clearEntries, formatRecordedAt, latestByMeasure, loadEntries, parseInputs, removeEntry,
  validateVitalValues, type VitalEntry,
} from '../utils/vitalsStore'

type Inputs = Partial<Record<keyof Vitals, string>>

const card = 'rounded-2xl border border-gray-200 bg-white shadow-sm'
const btnPrimary = 'min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'
const btnGhost = 'min-h-11 rounded-xl border border-gray-300 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

function AddSheet({ onSave, onClose }: { onSave: (values: ReturnType<typeof parseInputs>) => void; onClose: () => void }) {
  const [inputs, setInputs] = useState<Inputs>({})
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input')?.focus()
    return () => opener?.focus?.()
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
    if (e.key !== 'Tab' || !ref.current) return
    const items = ref.current.querySelectorAll<HTMLElement>('input,button')
    const first = items[0], last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const values = parseInputs(inputs)
    const problem = validateVitalValues(values)
    if (problem) { setError(problem); return }
    onSave(values)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="vitals-sheet-title"
        className="relative mx-auto max-h-[92%] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 id="vitals-sheet-title" className="text-lg font-bold text-gray-900">Add vitals</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-full text-2xl text-gray-500 hover:bg-gray-100">&times;</button>
        </div>
        <p className="mb-4 text-sm text-gray-500">Leave a box empty if you do not know that reading.</p>
        <form onSubmit={submit} noValidate>
          <div className="grid grid-cols-2 gap-3">
            {VITAL_FIELDS.map((f) => (
              <label key={f.key} className="block text-xs font-medium text-gray-600">
                {f.label}
                <input type="number" inputMode="decimal" step="any" min={f.min} max={f.max}
                  value={inputs[f.key] ?? ''} aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'vitals-error' : undefined}
                  onChange={(e) => { setInputs({ ...inputs, [f.key]: e.target.value }); setError(null) }}
                  className="mt-1 min-h-11 w-full rounded-xl border border-gray-300 px-3 text-base text-gray-900 focus:border-brand-500 focus:outline-2 focus:outline-brand-500" />
              </label>
            ))}
          </div>
          {error && <p id="vitals-error" role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={onClose} className={`${btnGhost} flex-1`}>Cancel</button>
            <button type="submit" className={`${btnPrimary} flex-1`}>Save</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function VitalsSection({ email }: { email: string }) {
  const [entries, setEntries] = useState<VitalEntry[]>(() => loadEntries(email))
  const [open, setOpen] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [prevEmail, setPrevEmail] = useState(email)
  if (prevEmail !== email) { setPrevEmail(email); setEntries(loadEntries(email)) }
  const latest = useMemo(() => latestByMeasure(entries), [entries])

  return (
    <section aria-labelledby="vitals-heading" className="px-4 pt-6 pb-4">
      <h2 id="vitals-heading" className="mb-3 text-xl font-bold text-gray-900">Vitals</h2>
      {entries.length === 0 ? (
        <div className={`${card} p-5 text-center`}>
          <p className="font-semibold text-gray-900">No vitals added yet</p>
          <p className="mt-1 text-sm text-gray-500">Add readings you have measured to keep them handy here.</p>
          <button type="button" onClick={() => setOpen(true)} className={`${btnPrimary} mt-4`}>Add vitals</button>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3">
            {latest.map((m) => (
              <li key={m.key} className={`${card} p-3`}>
                <p className="text-xs font-medium text-gray-500">{m.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{m.value} <span className="text-sm font-medium text-gray-500">{m.unit}</span></p>
                <p className="mt-1 text-[11px] text-gray-400">{formatRecordedAt(m.recordedAt)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setOpen(true)} className={`${btnPrimary} flex-1`}>Add vitals</button>
            <button type="button" onClick={() => setEntries(removeEntry(email, entries[0].id))} className={btnGhost}>Delete latest</button>
            <button type="button" onClick={() => setConfirmClear(true)} className={btnGhost}>Clear all</button>
          </div>
          {confirmClear && (
            <div role="alertdialog" aria-label="Confirm clear all vitals" className={`${card} mt-3 p-4`}>
              <p className="text-sm text-gray-700">Delete all saved vitals on this device?</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setConfirmClear(false)} className={`${btnGhost} flex-1`}>Keep</button>
                <button type="button" onClick={() => { setEntries(clearEntries(email)); setConfirmClear(false) }} className={`${btnPrimary} flex-1`}>Delete all</button>
              </div>
            </div>
          )}
        </>
      )}
      <p className="mt-3 text-xs text-gray-400">Saved only on this device. CareCompass does not interpret these readings.</p>
      {open && (
        <AddSheet
          onClose={() => setOpen(false)}
          onSave={(values) => { setEntries(addEntry(email, values)); setOpen(false) }}
        />
      )}
    </section>
  )
}
