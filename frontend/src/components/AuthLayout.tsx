import type { ReactNode } from 'react'

interface AuthLayoutProps {
  illustration: string
  tagline: string
  children: ReactNode
}

export function AuthLayout({ illustration, tagline, children }: AuthLayoutProps) {
  return (
    <div className="h-full overflow-y-auto bg-gray-50 md:flex md:items-start md:justify-center md:p-6">
      <div className="mx-auto w-full bg-white md:max-w-5xl md:overflow-hidden md:rounded-3xl md:shadow-xl md:grid md:grid-cols-2">
        <div className="flex items-center gap-3 rounded-b-[2.5rem] bg-brand-900 px-6 pb-8 pt-8 md:hidden">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 text-lg font-bold text-white">
            CC
          </span>
          <span className="text-lg font-semibold text-white">CareCompass</span>
        </div>

        <div className="hidden bg-brand-900 p-10 md:flex md:flex-col md:justify-between">
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

        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 md:px-12">
          {children}
        </div>
      </div>
    </div>
  )
}
