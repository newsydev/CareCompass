import type { ReactNode } from 'react'
import { Icon } from './Icon'
import { focusRing } from './styles'

export function SubPageHeader({ title, backLabel, onBack, action }: {
  title: string
  backLabel: string
  onBack: () => void
  action?: ReactNode
}) {
  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
      <button
        type="button" onClick={onBack} aria-label={backLabel}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-900 transition hover:bg-gray-200 ${focusRing}`}
      >
        <Icon name="back" />
      </button>
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-gray-900">{title}</h1>
      {action}
    </header>
  )
}
