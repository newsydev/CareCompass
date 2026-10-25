import { Icon, type IconName } from './Icon'
import { focusRing } from './styles'

export function MenuRow({ icon, iconTone, label, value, danger, soon, soonLabel, busy, tour, onClick }: {
  tour?: string
  icon: IconName
  iconTone: string
  label: string
  value?: string
  danger?: boolean
  soon?: boolean
  soonLabel?: string
  busy?: boolean
  onClick?: () => void
}) {
  const disabled = soon || busy
  return (
    <li data-tour={tour} className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-1 py-3 text-left transition enabled:hover:bg-gray-50 ${focusRing}`}
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconTone}`}>
          <Icon name={icon} />
        </span>
        <span className={`min-w-0 flex-1 text-base font-semibold ${soon ? 'text-gray-600' : danger ? 'text-red-700' : 'text-gray-900'}`}>
          {label}
        </span>
        {soon && (
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{soonLabel}</span>
        )}
        {value && <span className="shrink-0 text-gray-600">{value}</span>}
        {!soon && <Icon name="chevron" className={`h-5 w-5 shrink-0 ${danger ? 'text-red-700' : 'text-gray-500'}`} />}
      </button>
    </li>
  )
}
