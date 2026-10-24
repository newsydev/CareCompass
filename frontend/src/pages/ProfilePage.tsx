import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useDemoSession } from '../hooks/useDemoSession'
import { PatientTimeline } from '../components/PatientTimeline'
import type { DemoProfile } from '../utils/demoProfile'

export function ProfilePage({ profile }: { profile: DemoProfile }) {
  const { chats, updateProfile, importLegacy, busy, saving } = useDemoSession()
  const [activeTab, setActiveTab] = useState<'timeline' | 'profile'>('timeline')
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

  const inputClass = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20'

  return (
    <section className="h-full overflow-y-auto bg-slate-50 px-3 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white p-4 sm:p-7 shadow-xs">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <Link to="/triage" className="text-xs sm:text-sm font-semibold text-sky-600 hover:text-sky-700 flex items-center gap-1">
            <span>←</span>
            <span>Back to Care Chat</span>
          </Link>
          <span className="text-xs text-gray-400">Digital Health Record</span>
        </div>

        {/* Tab Navigation */}
        <div className="mt-4 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 rounded-lg py-2 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'timeline'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>📈</span>
            <span>Patient Medical Timeline</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 rounded-lg py-2 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'profile'
                ? 'bg-white text-sky-700 shadow-xs'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <span>⚙️</span>
            <span>Account & Medical Profile</span>
          </button>
        </div>

        {/* Tab 1: Medical Timeline */}
        {activeTab === 'timeline' && (
          <div className="mt-6">
            <PatientTimeline profile={profile} chats={chats} />
          </div>
        )}

        {/* Tab 2: Profile Settings */}
        {activeTab === 'profile' && (
          <div className="mt-6">
            <h1 className="text-xl font-bold text-gray-900">Patient Profile & Health Details</h1>
            <p className="mt-1.5 text-xs sm:text-sm text-gray-500">
              Manage your personal and medical information. These records are securely persisted to your CareCompass profile and used to personalize triage assessments.
            </p>

            <form onSubmit={submit} className="mt-5 flex flex-col gap-4 text-xs sm:text-sm text-gray-700">
              <label>
                Full name
                <input name="name" required maxLength={100} autoComplete="name" defaultValue={profile.name} className={inputClass} />
              </label>
              <label>
                Email
                <input type="email" readOnly value={profile.email} className={`${inputClass} bg-gray-100 text-gray-500 cursor-not-allowed`} />
              </label>
              <label>
                Care address
                <input name="address" autoComplete="street-address" maxLength={500} defaultValue={profile.address} className={inputClass} />
              </label>
              <label>
                Age in years (optional; decimals allowed for infants)
                <input name="age" type="number" min="0" max="120" step="any" defaultValue={profile.ageYears ?? ''} className={inputClass} />
              </label>
              <label>
                Medical history, medicines and allergies (optional)
                <textarea
                  name="medicalHistory"
                  maxLength={4000}
                  rows={4}
                  defaultValue={profile.medicalHistory}
                  placeholder="Known chronic conditions (Diabetes, Hypertension), regular medicines, allergies, or explicitly no known conditions."
                  className={inputClass}
                />
              </label>
              <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3.5 border border-slate-200/70">
                <span className="font-semibold text-gray-800 text-xs">Clinical Status Flags:</span>
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input type="checkbox" name="pregnant" defaultChecked={profile.pregnant} className="rounded text-sky-600 focus:ring-sky-500" />
                  <span>Pregnancy reported</span>
                </label>
                <label className="flex items-center gap-2 font-medium cursor-pointer">
                  <input type="checkbox" name="immunocompromised" defaultChecked={profile.immunocompromised} className="rounded text-sky-600 focus:ring-sky-500" />
                  <span>Reduced immunity / Immunocompromised status</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={busy || saving}
                className="mt-2 rounded-xl bg-sky-600 px-4 py-3 font-semibold text-white shadow-xs hover:bg-sky-700 active:bg-sky-800 disabled:opacity-50 transition"
              >
                {busy ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </form>

            <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-xs sm:text-sm text-gray-700" aria-label="Import earlier demo data">
              <h2 className="font-semibold text-amber-900">Import Earlier Browser Session Data</h2>
              <p className="mt-1 text-xs text-amber-800">
                Optional: import previous demo chats and notes stored in this browser for {profile.email}.
              </p>
              <label className="mt-2.5 flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={importConsent} onChange={(e) => setImportConsent(e.target.checked)} className="mt-0.5" />
                <span className="text-xs">I own this demo data and want it saved to my server account.</span>
              </label>
              <button
                type="button"
                disabled={!importConsent || busy || saving}
                onClick={async () => { if (await importLegacy()) navigate('/triage') }}
                className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50 transition"
              >
                Import Demo History
              </button>
            </section>
          </div>
        )}
      </div>
    </section>
  )
}
