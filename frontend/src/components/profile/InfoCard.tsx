import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { cardClass, focusRing } from './styles'

export function InfoCard({ icon, tone, title, editLabel, onEdit, tour, children }: {
  tour?: string
  icon: IconName
  tone: string
  title: string
  editLabel?: string
  onEdit?: () => void
  children: ReactNode
}) {
  return (
    <section data-tour={tour} className={`${cardClass} p-5`} aria-label={title}>
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <Icon name={icon} />
        </span>
        <h2 className="min-w-0 flex-1 text-lg font-bold text-gray-900">{title}</h2>
        {onEdit && (
          <button
            type="button" onClick={onEdit} aria-label={editLabel ?? title}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition hover:bg-gray-200 ${focusRing}`}
          >
            <Icon name="pencil" className="h-4 w-4" />
          </button>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-gray-100 py-3.5 last:border-b-0">
      <dt className="shrink-0 text-gray-600">{label}</dt>
      <dd className="min-w-0 break-words text-right font-semibold text-gray-900">{value}</dd>
    </div>
  )
}

export function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</dt>
      <dd className="mt-1 whitespace-pre-line break-words font-medium text-gray-900">{value}</dd>
    </div>
  )
}
