import type { CaregiverProfile } from '../api/types'
import { humanizeSlug } from '../utils/humanize'
import { careLabel, STRINGS, type UiLanguage } from '../utils/i18n'

interface CaregiverCardProps {
  matchScore: number
  matchReason: string
  profile: CaregiverProfile | undefined
  caregiverId: string
  onBook: () => void
  language?: UiLanguage
  disabled?: boolean
}

function formatMatchReason(reason: string, language: UiLanguage) {
  if (language !== 'hi' || !reason) return reason
  return reason
    .replace(/Hindi-speaking/gi, 'हिंदी-भाषी')
    .replace(/English-speaking/gi, 'अंग्रेज़ी-भाषी')
    .replace(/distance not verified \(location not shared\)/gi, 'दूरी सत्यापित नहीं (स्थान साझा नहीं)')
    .replace(/km away/gi, 'किमी दूर')
    .replace(/free (\d\d:\d\d)[–-](\d\d:\d\d)/gi, 'उपलब्ध समय $1–$2')
    .replace(/skilled in/gi, 'कौशल:')
    .replace(/\(next slot tomorrow\)/gi, '(अगला समय कल)')
    .replace(/base tier/gi, 'बेस टियर')
    .replace(/advanced tier/gi, 'एडवांस्ड टियर')
    .replace(/specialist tier/gi, 'स्पेशलिस्ट टियर')
}

export function CaregiverCard({
  matchScore,
  matchReason,
  profile,
  caregiverId,
  onBook,
  language = 'en',
  disabled = false,
}: CaregiverCardProps) {
  const t = STRINGS[language]
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-gray-900">{profile?.name ?? caregiverId}</h3>
          {profile?.role && (
            <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              {careLabel(profile.role, language) || humanizeSlug(profile.role)}
            </span>
          )}
          {profile?.rating != null && (
            <span className="text-xs font-medium text-amber-600">★ {profile.rating.toFixed(1)}</span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-600">{formatMatchReason(matchReason, language)}</p>
        <p className="mt-0.5 text-xs text-gray-400">{t.matchScore} {Math.round(matchScore * 100)}%</p>
      </div>
      <button
        type="button"
        onClick={onBook}
        disabled={disabled}
        className="shrink-0 disabled:opacity-50 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 active:bg-brand-700"
      >
        {t.book}
      </button>
    </div>
  )
}
