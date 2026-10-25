import type { ReactNode } from 'react'

export function ModeCard({ icon, title, desc, badge, soon, soonLabel, onClick }: {
  icon: ReactNode
  title: string
  desc: string
  badge?: string
  soon?: boolean
  soonLabel?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button" disabled={soon} onClick={onClick}
      className="flex w-full items-center gap-4 rounded-3xl border border-gray-100 bg-white p-4 text-left shadow-sm transition enabled:hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
    >
      <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${soon ? 'bg-gray-100 text-gray-600' : 'bg-brand-50 text-brand-700'}`}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`text-base font-bold ${soon ? 'text-gray-700' : 'text-gray-900'}`}>{title}</span>
          {badge && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900">{badge}</span>}
          {soon && <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-700">{soonLabel}</span>}
        </span>
        <span className="mt-1 block text-sm text-gray-600">{desc}</span>
      </span>
      {!soon && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-500">
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </button>
  )
}
