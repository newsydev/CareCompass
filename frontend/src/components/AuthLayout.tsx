import type { ReactNode } from 'react'

interface AuthLayoutProps {
  illustration: string
  tagline: string
  children: ReactNode
}

export function AuthLayout({ illustration, tagline, children }: AuthLayoutProps) {
  return (
    <div className="h-full overflow-y-auto bg-brand-50 p-4 md:flex md:items-start md:justify-center md:p-6">
      <div className="mx-auto w-full md:max-w-5xl md:overflow-hidden md:rounded-2xl md:shadow-xl md:grid md:grid-cols-2 bg-white">
        {/* Mobile header — compact brand strip, shown only below md */}
        <div className="flex items-center gap-3 bg-brand-500 px-6 py-5 md:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-lg font-bold text-white">
            CC
          </span>
          <span className="text-lg font-semibold text-white">CareCompass</span>
        </div>

        {/* Illustration panel — hidden on mobile, visible from md up */}
        <div className="hidden md:flex md:flex-col md:justify-between bg-brand-500 p-10">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-lg font-bold text-white">
              CC
            </span>
            <span className="text-xl font-semibold text-white">CareCompass</span>
          </div>
          <div className="flex flex-1 items-center justify-center py-10">
            <img
              src={illustration}
              alt=""
              className="max-h-72 w-auto object-contain drop-shadow-xl"
            />
          </div>
          <p className="text-balance text-lg font-medium leading-snug text-white/90">
            {tagline}
          </p>
        </div>

        {/* Form panel */}
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 md:px-12">
          {children}
        </div>
      </div>
    </div>
  )
}
