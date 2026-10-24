import { humanizeSlug, urgencyBadgeClass } from '../utils/humanize'

interface RecommendationCardProps {
  careType: string | null
  urgency: string | null
  reasoning: string | null
}

export function RecommendationCard({ careType, urgency, reasoning }: RecommendationCardProps) {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-gray-900">{humanizeSlug(careType)}</h2>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${urgencyBadgeClass(urgency)}`}
        >
          {humanizeSlug(urgency)}
        </span>
      </div>
      {reasoning && <p className="mt-3 text-gray-700">{reasoning}</p>}
    </div>
  )
}
