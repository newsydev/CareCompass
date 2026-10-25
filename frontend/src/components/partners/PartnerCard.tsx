import type { CaregiverProfile } from '../../api/types'
import { parseList, roleLabel, skillLabel } from '../../utils/partners'

const MAX_SKILLS = 3

function Pill({ children }: { children: string }) {
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{children}</span>
}

export function PartnerCard({ partner }: { partner: CaregiverProfile }) {
  const name = partner.name?.trim() || 'Unnamed'
  const languages = parseList(partner.languages)
  const skills = parseList(partner.skills)
  const rating = typeof partner.rating === 'number' && partner.rating > 0 ? partner.rating : null
  const hasExp = typeof partner.experience_years === 'number'
  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-700">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-base font-semibold text-gray-900">{name}</h3>
            {rating !== null && <span className="shrink-0 text-sm font-medium text-gray-800" aria-label={`Rating ${rating.toFixed(1)} out of 5`}>★ {rating.toFixed(1)}</span>}
          </div>
          <p className="text-sm text-brand-700">{roleLabel(partner.role)}{partner.qualification ? <span className="text-gray-600"> · {partner.qualification}</span> : null}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {[hasExp ? `${partner.experience_years} yrs experience` : '', partner.base_area].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      {(languages.length > 0 || skills.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {languages.map((l) => <span key={l} className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{l}</span>)}
          {skills.slice(0, MAX_SKILLS).map((s) => <Pill key={s}>{skillLabel(s)}</Pill>)}
          {skills.length > MAX_SKILLS && <Pill>{`+${skills.length - MAX_SKILLS} more`}</Pill>}
        </div>
      )}
    </li>
  )
}
