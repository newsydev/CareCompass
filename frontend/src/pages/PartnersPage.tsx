import { useMemo, useState } from 'react'
import { useCaregivers } from '../hooks/useCaregivers'
import { PartnerCard } from '../components/partners/PartnerCard'
import { TabHeader } from '../components/TabHeader'
import { activePartners, parseList, rolesPresent, roleLabel, visiblePartners } from '../utils/partners'
import { useUiLanguage } from '../utils/i18n'
import { localArea, localName, localQualification, localRole, localSkill } from '../utils/localizeNames'

const chipBase = 'min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'
const chipOn = 'border-brand-600 bg-brand-600 text-white'
const chipOff = 'border-gray-300 bg-white text-gray-700'

const TEXT = {
  en: {
    title: 'Partners', sub: 'Doctors, nurses and caregivers on CareCompass.', loading: 'Loading partners', error: 'Could not load partners.',
    retrying: 'Retrying...', retry: 'Retry', filter: 'Filter by role', all: 'All', search: 'Search name, skill or area',
    searchLabel: 'Search partners', one: 'partner', many: 'partners', none: 'No partners match',
  },
  hi: {
    title: 'पार्टनर', sub: 'CareCompass पर डॉक्टर, नर्स और केयरगिवर।', loading: 'पार्टनर लोड हो रहे हैं', error: 'पार्टनर लोड नहीं हो सके।',
    retrying: 'दोबारा कोशिश हो रही है...', retry: 'दोबारा कोशिश करें', filter: 'भूमिका के अनुसार छाँटें', all: 'सभी',
    search: 'नाम, कौशल या इलाका खोजें', searchLabel: 'पार्टनर खोजें', one: 'पार्टनर', many: 'पार्टनर', none: 'कोई पार्टनर नहीं मिला',
  },
}

export function PartnersPage() {
  const { data, isLoading, isError, refetch, isFetching } = useCaregivers()
  const [language] = useUiLanguage()
  const t = TEXT[language]
  const roleText = (r: string) => localRole(r, language, true) ?? roleLabel(r)
  const [role, setRole] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const roles = useMemo(() => rolesPresent(activePartners(data)), [data])
  const shown = useMemo(() => visiblePartners(data, role, query, (p) => [
    localName(p.name?.trim(), language), localRole(p.role, language, true), localQualification(p.qualification, language),
    localArea(p.base_area, language), ...parseList(p.skills).map((s) => localSkill(s, language)),
  ]), [data, role, query, language])

  return (
    <div className="h-full overflow-y-auto">
      <TabHeader title={t.title} subtitle={t.sub} />
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-4">

      {isLoading && (
        <ul className="space-y-3" aria-busy="true" aria-label={t.loading}>
          {[0, 1, 2, 3].map((i) => <li key={i} className="h-28 animate-pulse rounded-3xl border border-gray-100 bg-gray-100" />)}
        </ul>
      )}

      {isError && (
        <div role="alert" className="rounded-3xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{t.error}</p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className="mt-3 min-h-11 rounded-full bg-brand-600 px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60">
            {isFetching ? t.retrying : t.retry}
          </button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t.filter} data-tour="partners-filter">
            <button type="button" aria-pressed={role === null} onClick={() => setRole(null)} className={`${chipBase} ${role === null ? chipOn : chipOff}`}>{t.all}</button>
            {roles.map((r) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} className={`${chipBase} ${role === r ? chipOn : chipOff}`}>{roleText(r)}</button>
            ))}
          </div>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} aria-label={t.searchLabel} className="mt-3 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-600" />
          <p className="mt-3 text-xs text-gray-500" aria-live="polite">{shown.length} {shown.length === 1 ? t.one : t.many}</p>
          {shown.length === 0 ? (
            <p className="mt-6 rounded-3xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">{t.none}</p>
          ) : (
            <ul data-tour="partners-list" className="mt-2 space-y-3">{shown.map((p) => <PartnerCard key={p.caregiver_id} partner={p} language={language} />)}</ul>
          )}
        </>
      )}
      </div>
    </div>
  )
}
