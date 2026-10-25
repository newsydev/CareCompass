import { useState } from 'react'
import type { DemoProfile } from '../../utils/demoProfile'
import { BLOOD_GROUPS, GENDERS, ageFromDob, isValidDob } from './format'
import { Sheet } from './Sheet'
import { fieldClass, focusRing } from './styles'
import type { ProfileStrings } from './strings'

const GENDER_LABEL = { male: 'male', female: 'female', other: 'other', prefer_not: 'preferNot' } as const

export function EditPersonalSheet({ profile, t, busy, error, onSave, onClose }: {
  profile: DemoProfile
  t: ProfileStrings
  busy: boolean
  error: string | null
  onSave: (next: DemoProfile) => Promise<boolean>
  onClose: () => void
}) {
  const [dob, setDob] = useState(profile.dateOfBirth ?? '')
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const [formError, setFormError] = useState<string | null>(null)
  const derivedAge = dob ? ageFromDob(dob) : undefined

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const text = (key: string) => String(data.get(key) ?? '').trim()
    if (dob && !isValidDob(dob)) {
      setFormError(t.dobInvalid)
      return
    }
    setFormError(null)
    const age = text('age')
    const saved = await onSave({
      ...profile,
      name: text('name'),
      phone: text('phone'),
      address: text('address'),
      dateOfBirth: dob,
      gender: text('gender'),
      bloodGroup: text('bloodGroup'),
      ageYears: dob ? derivedAge : age ? Number(age) : undefined,
    })
    if (saved) onClose()
  }

  return (
    <Sheet title={t.editPersonal} onClose={onClose}>
      <form onSubmit={submit} className="mt-4 flex flex-col gap-3 text-sm font-medium text-gray-700">
        <label>
          {t.name}
          <input name="name" required maxLength={100} autoComplete="name" defaultValue={profile.name} className={fieldClass} />
        </label>
        <label>
          {t.phone}
          <input name="phone" type="tel" inputMode="tel" maxLength={20} autoComplete="tel" defaultValue={profile.phone ?? ''} className={fieldClass} />
        </label>
        <label>
          {t.email}
          <input type="email" readOnly value={profile.email} className={`${fieldClass} cursor-not-allowed bg-gray-100 text-gray-600`} />
        </label>
        <label>
          {t.dob}
          <input
            type="date" value={dob} max={today}
            onChange={(e) => setDob(e.target.value)} className={fieldClass}
          />
        </label>
        <label>
          {t.age}
          <input
            name="age" type="number" min="0" max="120" step="any"
            disabled={Boolean(dob)} key={dob ? 'derived' : 'manual'}
            defaultValue={dob ? derivedAge ?? '' : profile.ageYears ?? ''}
            aria-describedby={dob ? 'age-hint' : undefined}
            className={fieldClass}
          />
          {dob && <span id="age-hint" className="mt-1 block text-xs font-normal text-gray-600">{t.ageFromDob}</span>}
        </label>
        <label>
          {t.gender}
          <select name="gender" defaultValue={profile.gender ?? ''} className={fieldClass}>
            <option value="">{t.select}</option>
            {GENDERS.map((value) => <option key={value} value={value}>{t[GENDER_LABEL[value]]}</option>)}
          </select>
        </label>
        <label>
          {t.bloodGroup}
          <select name="bloodGroup" defaultValue={profile.bloodGroup ?? ''} className={fieldClass}>
            <option value="">{t.select}</option>
            {BLOOD_GROUPS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label>
          {t.address}
          <input name="address" maxLength={500} autoComplete="street-address" defaultValue={profile.address} className={fieldClass} />
        </label>
        {(formError ?? error) && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{formError ?? error}</p>}
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
