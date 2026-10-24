import type { PatientContext } from '../api/types'
import { VITAL_FIELDS } from '../utils/patientContext'

interface PatientContextFormProps {
  value: PatientContext
  onChange: (value: PatientContext) => void
  recipient: 'self' | 'other'
  onRecipientChange: (value: 'self' | 'other') => void
  disabled: boolean
  recipientLocked: boolean
}

export function PatientContextForm({ value, onChange, recipient, onRecipientChange, disabled, recipientLocked }: PatientContextFormProps) {
  const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900'
  return (
    <section className="mt-4 rounded-xl border border-gray-200 bg-white p-4" aria-label="Patient context">
      <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-700">
        Care is for
        <select
          value={recipient}
          disabled={disabled || recipientLocked}
          onChange={(e) => onRecipientChange(e.target.value === 'self' ? 'self' : 'other')}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2"
        >
          <option value="self">Myself (use my profile)</option>
          <option value="other">Someone else (enter their details)</option>
        </select>
      </label>
      {recipientLocked && <p className="mt-1 text-xs text-gray-500">Start a new chat to change patients. This conversation keeps its own patient history and vitals.</p>}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">Patient history and vitals (optional)</summary>
        <fieldset disabled={disabled} className="mt-3 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">
          <p className="sm:col-span-2">Enter this patient's details only. Leave unknown measurements blank; never delay emergency help to collect them. These details are sent to the CareCompass API, not used to make a diagnosis.</p>
          <label>Patient age (years)
            <input type="number" min="0" max="120" step="any" value={value.age_years ?? ''} onChange={(e) => onChange({ ...value, age_years: e.target.value === '' ? undefined : Number(e.target.value) })} className={inputClass} />
          </label>
          <label className="sm:col-span-2">Patient history, medicines and allergies
            <textarea maxLength={4000} rows={3} value={value.medical_history} onChange={(e) => onChange({ ...value, medical_history: e.target.value })} placeholder="Known conditions, regular medicines, allergies, or no known conditions. Blank means unknown." className={inputClass} />
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={value.pregnant} onChange={(e) => onChange({ ...value, pregnant: e.target.checked })} />Pregnancy reported</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={value.immunocompromised} onChange={(e) => onChange({ ...value, immunocompromised: e.target.checked })} />Reduced immunity reported</label>
          {VITAL_FIELDS.map((field) => (
            <label key={field.key}>{field.label}
              <input type="number" min={field.min} max={field.max} step="any" value={value.vitals[field.key] ?? ''} onChange={(e) => onChange({ ...value, vitals: { ...value.vitals, [field.key]: e.target.value === '' ? undefined : Number(e.target.value) } })} className={inputClass} />
            </label>
          ))}
        </fieldset>
      </details>
    </section>
  )
}
