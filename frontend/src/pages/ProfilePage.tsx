import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDemoSession } from '../hooks/useDemoSession'
import { PatientTimeline } from '../components/PatientTimeline'
import { EditMedicalSheet } from '../components/profile/EditMedicalSheet'
import { EditPersonalSheet } from '../components/profile/EditPersonalSheet'
import { Icon } from '../components/profile/Icon'
import { InfoBlock, InfoCard, InfoRow } from '../components/profile/InfoCard'
import { MenuRow } from '../components/profile/MenuRow'
import { ProfileHeader } from '../components/profile/ProfileHeader'
import { Sheet } from '../components/profile/Sheet'
import { SubPageHeader } from '../components/profile/SubPageHeader'
import { displayValue, formatDob } from '../components/profile/format'
import { profileStrings } from '../components/profile/strings'
import { cardClass, focusRing } from '../components/profile/styles'
import { PrescriptionsPage } from './profile/PrescriptionsPage'
import { ReportsPage } from './profile/ReportsPage'
import { SupportPage } from './profile/SupportPage'
import { useUiLanguage, type UiLanguage } from '../utils/i18n'
import { useTutorial } from '../hooks/useTutorial'
import type { DemoProfile } from '../utils/demoProfile'

type View = 'home' | 'prescriptions' | 'reports' | 'support' | 'timeline' | 'import'
type Dialog = 'personal' | 'medical' | 'language' | null

const GENDER_KEY = { male: 'male', female: 'female', other: 'other', prefer_not: 'preferNot' } as const

export function ProfilePage({ profile }: { profile: DemoProfile }) {
  const { chats, updateProfile, importLegacy, logout, busy, saving, error } = useDemoSession()
  const { start: startTutorial } = useTutorial()
  const [language, setLanguage] = useUiLanguage()
  const [view, setView] = useState<View>('home')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [shareNote, setShareNote] = useState('')
  const [importConsent, setImportConsent] = useState(false)
  const scroller = useRef<HTMLElement>(null)
  const navigate = useNavigate()
  const t = profileStrings(language)

  useEffect(() => { scroller.current?.scrollTo(0, 0) }, [view])

  const goHome = () => setView('home')
  const none = t.none
  const genderKey = profile.gender ? GENDER_KEY[profile.gender as keyof typeof GENDER_KEY] : undefined
  const age = profile.ageYears !== undefined ? ` (${profile.ageYears}${language === 'hi' ? ' वर्ष' : ' y'})` : ''

  async function share() {
    const url = window.location.origin
    try {
      if (navigator.share) {
        await navigator.share({ title: 'CareCompass', text: t.shareText, url })
        setShareNote('')
      } else {
        await navigator.clipboard.writeText(url)
        setShareNote(t.shareCopied)
      }
    } catch (failure) {
      if (failure instanceof DOMException && failure.name === 'AbortError') return
      setShareNote(t.shareFailed)
    }
  }

  let body
  if (view === 'prescriptions') body = <PrescriptionsPage t={t} onBack={goHome} />
  else if (view === 'reports') body = <ReportsPage t={t} onBack={goHome} />
  else if (view === 'support') body = <SupportPage t={t} onBack={goHome} />
  else if (view === 'timeline') {
    body = (
      <>
        <SubPageHeader title={t.timeline} backLabel={t.back} onBack={goHome} />
        <div className="mx-auto max-w-2xl px-4 pb-28 pt-4"><PatientTimeline profile={profile} chats={chats} /></div>
      </>
    )
  } else if (view === 'import') {
    body = (
      <>
        <SubPageHeader title={t.importData} backLabel={t.back} onBack={goHome} />
        <section className="mx-auto max-w-2xl px-4 pb-28 pt-4" aria-label={t.importTitle}>
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-gray-800">
            <h2 className="font-bold text-amber-900">{t.importTitle}</h2>
            <p className="mt-1 text-amber-900">{t.importHint} {profile.email}</p>
            <label className="mt-3 flex cursor-pointer items-start gap-2">
              <input
                type="checkbox" checked={importConsent} onChange={(e) => setImportConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand-600"
              />
              <span>{t.importConsent}</span>
            </label>
            <button
              type="button" disabled={!importConsent || busy || saving}
              onClick={async () => { if (await importLegacy()) navigate('/triage') }}
              className={`mt-4 rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700 disabled:bg-brand-300 ${focusRing}`}
            >
              {t.importButton}
            </button>
          </div>
          {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        </section>
      </>
    )
  } else {
    body = (
      <>
        <ProfileHeader name={profile.name} contact={profile.phone || profile.email} photoLabel={t.changePhoto} />
        <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-28 pt-6">
          {error && !dialog && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}

          <InfoCard tour="profile-personal" icon="user" tone="bg-gray-100 text-gray-700" title={t.personalInfo} editLabel={t.editPersonal} onEdit={() => setDialog('personal')}>
            <dl>
              <InfoRow label={t.name} value={profile.name} />
              <InfoRow label={t.dob} value={`${formatDob(profile.dateOfBirth, language === 'hi' ? 'hi-IN' : 'en-IN')}${profile.dateOfBirth ? age : ''}`} />
              {!profile.dateOfBirth && profile.ageYears !== undefined && <InfoRow label={t.age} value={String(profile.ageYears)} />}
              <InfoRow label={t.gender} value={genderKey ? t[genderKey] : '-'} />
              <InfoRow label={t.bloodGroup} value={displayValue(profile.bloodGroup)} />
              {profile.address && <InfoRow label={t.address} value={profile.address} />}
            </dl>
          </InfoCard>

          <InfoCard tour="profile-medical" icon="heart" tone="bg-brand-50 text-brand-700" title={t.medicalHistory} editLabel={t.editMedical} onEdit={() => setDialog('medical')}>
            <dl>
              <InfoBlock label={t.allergies} value={displayValue(profile.allergies, none)} />
              <InfoBlock label={t.pastHistory} value={displayValue(profile.pastHistory, none)} />
              <InfoBlock label={t.currentMedications} value={displayValue(profile.currentMedications, none)} />
              <InfoBlock label={t.familyHistory} value={displayValue(profile.familyHistory, none)} />
              {profile.medicalHistory && <InfoBlock label={t.notes} value={profile.medicalHistory} />}
            </dl>
          </InfoCard>

          <section data-tour="profile-more" className={`${cardClass} p-5`} aria-label={t.more}>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Icon name="shield" />
              </span>
              <h2 className="text-lg font-bold text-gray-900">{t.more}</h2>
            </div>
            <ul className="mt-2">
              <MenuRow icon="doc" iconTone="bg-brand-50 text-brand-700" label={t.myPrescriptions} onClick={() => setView('prescriptions')} />
              <MenuRow icon="doc" iconTone="bg-amber-50 text-amber-700" label={t.myReports} onClick={() => setView('reports')} />
              <MenuRow icon="timeline" iconTone="bg-brand-50 text-brand-700" label={t.timeline} onClick={() => setView('timeline')} />
              <MenuRow icon="globe" iconTone="bg-gray-100 text-gray-700" label={t.language} value={t.languageName} onClick={() => setDialog('language')} />
              <MenuRow icon="chat" iconTone="bg-gray-100 text-gray-700" label={t.support} onClick={() => setView('support')} />
              <MenuRow icon="download" iconTone="bg-gray-100 text-gray-700" label={t.importData} onClick={() => setView('import')} />
              <MenuRow icon="compass" iconTone="bg-emerald-50 text-emerald-700" label={t.replayTutorial} onClick={startTutorial} />
              <MenuRow
                icon="logout" iconTone="bg-red-50 text-red-700" danger
                tour="profile-logout" label={busy ? t.loggingOut : t.logout} busy={busy} onClick={() => { void logout() }}
              />
              <MenuRow icon="trash" iconTone="bg-red-50 text-red-700" label={t.deleteAccount} soon soonLabel={t.comingSoonShort} />
            </ul>
          </section>

          <button
            type="button" onClick={share}
            className={`${cardClass} flex w-full items-center gap-3 p-5 text-left transition hover:bg-gray-50 ${focusRing}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
              <Icon name="share" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-bold text-gray-900">{t.shareTitle}</span>
              <span className="block text-sm text-gray-600">{t.shareDesc}</span>
            </span>
            <Icon name="chevron" className="h-5 w-5 shrink-0 text-gray-500" />
          </button>
          <p role="status" aria-live="polite" className="text-center text-sm text-gray-700">{shareNote}</p>
        </div>
      </>
    )
  }

  return (
    <section ref={scroller} className="h-full overflow-y-auto overflow-x-hidden bg-gray-50">
      {body}

      {dialog === 'personal' && (
        <EditPersonalSheet profile={profile} t={t} busy={busy} error={error} onSave={updateProfile} onClose={() => setDialog(null)} />
      )}
      {dialog === 'medical' && (
        <EditMedicalSheet profile={profile} t={t} busy={busy} error={error} onSave={updateProfile} onClose={() => setDialog(null)} />
      )}
      {dialog === 'language' && (
        <Sheet title={t.chooseLanguage} onClose={() => setDialog(null)}>
          <div role="radiogroup" aria-label={t.chooseLanguage} className="mt-4 flex flex-col gap-2">
            {([['en', 'English'], ['hi', 'हिन्दी']] as [UiLanguage, string][]).map(([code, label]) => (
              <button
                key={code} type="button" role="radio" aria-checked={language === code}
                onClick={() => { setLanguage(code); setDialog(null) }}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left font-semibold ${focusRing} ${
                  language === code ? 'border-brand-600 bg-brand-50 text-brand-900' : 'border-gray-300 text-gray-900 hover:bg-gray-50'
                }`}
              >
                {label}
                {language === code && <span aria-hidden="true">✓</span>}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </section>
  )
}
