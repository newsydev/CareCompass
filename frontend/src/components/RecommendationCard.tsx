import { urgencyBadgeClass } from '../utils/humanize'
import { careLabel, type UiLanguage } from '../utils/i18n'
import { translateReasoning } from '../utils/chatSummary'

interface RecommendationCardProps {
  careType: string | null
  urgency: string | null
  reasoning: string | null
  language?: UiLanguage
}

export function RecommendationCard({ careType, urgency, reasoning, language = 'en' }: RecommendationCardProps) {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-gray-900">{careLabel(careType, language)}</h2>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${urgencyBadgeClass(urgency)}`}
        >
          {careLabel(urgency, language)}
        </span>
      </div>
      {reasoning && (
        <p className="mt-3 text-gray-700">
          {language === 'hi' ? translateReasoning(reasoning, 'hi') : reasoning}
        </p>
      )}
    </div>
  )
}
