import type { CaregiverProfile } from '../../api/types'
import type { UiLanguage } from '../../utils/i18n'
import { localArea, localLanguage, localName, localQualification, localRole, localSkill } from '../../utils/localizeNames'
import { parseList, roleLabel, skillLabel } from '../../utils/partners'

const MAX_SKILLS = 3

function Pill({ children }: { children: string }) {
  return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{children}</span>
}

export function PartnerCard({ partner, language = 'en' }: { partner: CaregiverProfile; language?: UiLanguage }) {
  const hi = language === 'hi'
  const name = localName(partner.name?.trim(), language) || (hi ? 'बिना नाम' : 'Unnamed')
  const languages = parseList(partner.languages)
  const skills = parseList(partner.skills)
  const rating = typeof partner.rating === 'number' && partner.rating > 0 ? partner.rating : null
  const hasExp = typeof partner.experience_years === 'number'
  const role = localRole(partner.role, language, true) ?? roleLabel(partner.role)
  const qualification = localQualification(partner.qualification, language)
  return (
    <li className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-base font-semibold text-brand-700">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-base font-semibold text-gray-900">{name}</h3>
            {rating !== null && <span className="shrink-0 text-sm font-medium text-gray-800" aria-label={hi ? `रेटिंग 5 में से ${rating.toFixed(1)}` : `Rating ${rating.toFixed(1)} out of 5`}>★ {rating.toFixed(1)}</span>}
          </div>
          <p className="text-sm text-brand-700">{role}{qualification ? <span className="text-gray-600"> · {qualification}</span> : null}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {[hasExp ? (hi ? `${partner.experience_years} वर्ष का अनुभव` : `${partner.experience_years} yrs experience`) : '', localArea(partner.base_area, language)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      {(languages.length > 0 || skills.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {languages.map((l) => <span key={l} className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs text-brand-700">{localLanguage(l, language)}</span>)}
          {skills.slice(0, MAX_SKILLS).map((s) => <Pill key={s}>{localSkill(s, language) ?? skillLabel(s)}</Pill>)}
          {skills.length > MAX_SKILLS && <Pill>{hi ? `+${skills.length - MAX_SKILLS} और` : `+${skills.length - MAX_SKILLS} more`}</Pill>}
        </div>
      )}
    </li>
  )
}
