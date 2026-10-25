import { Icon, type IconName } from './Icon'

export function EmptyState({ icon, title, hint }: { icon: IconName; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <Icon name={icon} className="h-14 w-14 text-gray-500" />
      <p className="mt-4 text-lg font-bold text-gray-900">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-gray-600">{hint}</p>
    </div>
  )
}

export function SoonButton({ icon, label, soon, className = '' }: { icon?: IconName; label: string; soon: string; className?: string }) {
  return (
    <button
      type="button" disabled aria-label={`${label} (${soon})`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 ${className}`}
    >
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {label}
    </button>
  )
}
