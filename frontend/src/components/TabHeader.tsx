import type { ReactNode } from 'react'

/** Dark brand header shared by the main tab pages (Home, Consult, Partners, Profile). */
export function TabHeader({ title, subtitle, children }: { title?: string; subtitle?: string; children?: ReactNode }) {
  return (
    <header className="rounded-b-[2.5rem] bg-brand-900 px-4 pb-8 pt-10 text-white">
      {title && <h1 className="text-3xl font-bold">{title}</h1>}
      {subtitle && <p className="mt-1 text-sm text-brand-100">{subtitle}</p>}
      {children}
    </header>
  )
}
