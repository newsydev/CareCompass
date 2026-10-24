import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useDemoSession } from '../hooks/useDemoSession'
import type { DemoProfile } from '../utils/demoProfile'

export function ProfilePage({ profile }: { profile: DemoProfile }) {
  const { updateProfile, importLegacy, busy, saving } = useDemoSession()
  const [importConsent, setImportConsent] = useState(false)
  const navigate = useNavigate()
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const age = String(data.get('age') ?? '')
    const saved = await updateProfile({
      email: profile.email,
      name: String(data.get('name')).trim(),
      address: String(data.get('address') ?? '').trim(),
      ageYears: age ? Number(age) : undefined,
      medicalHistory: String(data.get('medicalHistory') ?? '').trim(),
      pregnant: data.get('pregnant') === 'on',
      immunocompromised: data.get('immunocompromised') === 'on',
    })
    if (saved) navigate('/triage')
  }
  const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900'
  return (
    <section className="h-full overflow-y-auto bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-5 sm:p-8">
        <Link to="/triage" className="text-sm text-brand-600">Back to chat</Link>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Your profile</h1>
        <p className="mt-2 text-sm text-gray-500">Your profile and conversations are saved to the server's SQLite database and protected by your account password. Storage is not encrypted at rest or a certified medical-record system; use fictional health data.</p>
        <form onSubmit={submit} className="mt-5 flex flex-col gap-4 text-sm text-gray-700">
          <label>Full name<input name="name" required maxLength={100} autoComplete="name" defaultValue={profile.name} className={inputClass} /></label>
          <label>Email<input type="email" readOnly value={profile.email} className={`${inputClass} bg-gray-50`} /></label>
          <label>Care address<input name="address" autoComplete="street-address" maxLength={500} defaultValue={profile.address} className={inputClass} /></label>
          <label>Age in years (optional; decimals allowed for infants)<input name="age" type="number" min="0" max="120" step="any" defaultValue={profile.ageYears ?? ''} className={inputClass} /></label>
          <label>Medical history, medicines and allergies (optional)
            <textarea name="medicalHistory" maxLength={4000} rows={4} defaultValue={profile.medicalHistory} placeholder="Known conditions, regular medicines, allergies, or explicitly no known conditions. Leave blank if unknown." className={inputClass} />
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" name="pregnant" defaultChecked={profile.pregnant} />Pregnancy reported</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="immunocompromised" defaultChecked={profile.immunocompromised} />Reduced immunity reported</label>
          <p className="text-xs text-gray-500">These details are used only when you choose care for yourself. For someone else, enter that patient's details in the chat. Selected history and vitals are sent to the CareCompass API for demo screening.</p>
          <button type="submit" disabled={busy || saving} className="rounded-lg bg-brand-500 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Saving...' : 'Save profile'}</button>
        </form>
        <section className="mt-6 rounded-lg border border-amber-200 p-4 text-sm text-gray-700" aria-label="Import earlier demo data">
          <h2 className="font-semibold">Import earlier browser demo data</h2>
          <p className="mt-2">Optional: import the old demo profile and chats for {profile.email} from this browser tab. This replaces your saved profile and adds missing chats; existing database chats are not overwritten. Browser data is not deleted.</p>
          <label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={importConsent} onChange={(e) => setImportConsent(e.target.checked)} />I own this demo data and want it saved to my account.</label>
          <button type="button" disabled={!importConsent || busy || saving} onClick={async () => { if (await importLegacy()) navigate('/triage') }} className="mt-3 rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-50">Import demo data</button>
        </section>
      </div>
    </section>
  )
}
