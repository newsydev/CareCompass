import { useMemo, useState } from 'react'
import { useCaregivers } from '../hooks/useCaregivers'
import { PartnerCard } from '../components/partners/PartnerCard'
import { activePartners, rolesPresent, roleLabel, visiblePartners } from '../utils/partners'

const chipBase = 'min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'
const chipOn = 'border-brand-600 bg-brand-600 text-white'
const chipOff = 'border-gray-300 bg-white text-gray-700'

export function PartnersPage() {
  const { data, isLoading, isError, refetch, isFetching } = useCaregivers()
  const [role, setRole] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const roles = useMemo(() => rolesPresent(activePartners(data)), [data])
  const shown = useMemo(() => visiblePartners(data, role, query), [data, role, query])

  return (
    <div className="h-full overflow-y-auto px-4 pb-24 pt-5">
      <h1 className="text-2xl font-bold text-gray-900">Partners</h1>
      <p className="mt-1 text-sm text-gray-600">Doctors, nurses and caregivers on CareCompass.</p>

      {isLoading && (
        <ul className="mt-5 space-y-3" aria-busy="true" aria-label="Loading partners">
          {[0, 1, 2, 3].map((i) => <li key={i} className="h-28 animate-pulse rounded-2xl border border-gray-200 bg-gray-100" />)}
        </ul>
      )}

      {isError && (
        <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">Could not load partners.</p>
          <button type="button" onClick={() => void refetch()} disabled={isFetching} className="mt-3 min-h-11 rounded-full bg-brand-600 px-5 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60">
            {isFetching ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by role">
            <button type="button" aria-pressed={role === null} onClick={() => setRole(null)} className={`${chipBase} ${role === null ? chipOn : chipOff}`}>All</button>
            {roles.map((r) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} className={`${chipBase} ${role === r ? chipOn : chipOff}`}>{roleLabel(r)}</button>
            ))}
          </div>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, skill or area" aria-label="Search partners" className="mt-3 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-600" />
          <p className="mt-3 text-xs text-gray-500" aria-live="polite">{shown.length} {shown.length === 1 ? 'partner' : 'partners'}</p>
          {shown.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-600">No partners match</p>
          ) : (
            <ul className="mt-2 space-y-3">{shown.map((p) => <PartnerCard key={p.caregiver_id} partner={p} />)}</ul>
          )}
        </>
      )}
    </div>
  )
}
