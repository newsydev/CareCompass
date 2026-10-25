import type { DemoProfile } from '../../utils/demoProfile'
import { Sheet } from './Sheet'
import { fieldClass, focusRing } from './styles'
import type { ProfileStrings } from './strings'

export function EditMedicalSheet({ profile, t, busy, error, onSave, onClose }: {
  profile: DemoProfile
  t: ProfileStrings
  busy: boolean
  error: string | null
  onSave: (next: DemoProfile) => Promise<boolean>
  onClose: () => void
}) {
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const text = (key: string) => String(data.get(key) ?? '').trim()
    const saved = await onSave({
      ...profile,
      allergies: text('allergies'),
      pastHistory: text('pastHistory'),
      currentMedications: text('currentMedications'),
      familyHistory: text('familyHistory'),
      medicalHistory: text('medicalHistory'),
      pregnant: data.get('pregnant') === 'on',
      immunocompromised: data.get('immunocompromised') === 'on',
    })
    if (saved) onClose()
  }

  const areas = [
    ['allergies', t.allergies, profile.allergies],
    ['pastHistory', t.pastHistory, profile.pastHistory],
    ['currentMedications', t.currentMedications, profile.currentMedications],
    ['familyHistory', t.familyHistory, profile.familyHistory],
  ] as const

  return (
    <Sheet title={t.editMedical} onClose={onClose}>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 text-sm font-medium text-gray-700">
        {areas.map(([name, label, value]) => (
          <label key={name}>
            {label}
            <textarea name={name} rows={2} maxLength={1000} defaultValue={value ?? ''} className={fieldClass} />
          </label>
        ))}
        <label>
          {t.notes}
          <textarea name="medicalHistory" rows={3} maxLength={4000} defaultValue={profile.medicalHistory} className={fieldClass} />
          <span className="mt-1 block text-xs font-normal text-gray-600">{t.notesHint}</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="pregnant" defaultChecked={profile.pregnant} className="h-4 w-4 accent-brand-600" />
          {t.pregnant}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="immunocompromised" defaultChecked={profile.immunocompromised} className="h-4 w-4 accent-brand-600" />
          {t.immunocompromised}
        </label>
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <div className="mt-2 flex gap-3">
          <button type="button" onClick={onClose} className={`flex-1 rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-800 hover:bg-gray-50 ${focusRing}`}>
            {t.cancel}
          </button>
          <button type="submit" disabled={busy} className={`flex-1 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:bg-brand-300 ${focusRing}`}>
            {busy ? t.saving : t.save}
          </button>
        </div>
      </form>
    </Sheet>
  )
}
