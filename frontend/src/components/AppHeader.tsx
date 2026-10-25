import { Link } from 'react-router-dom'
import { useDemoSession } from '../hooks/useDemoSession'
import { InstallPwaButton } from './InstallPwaButton'

// Signed-out header only; signed-in pages carry their own headers and the bottom navigation.
export function AppHeader() {
  const { error } = useDemoSession()
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between gap-3 border-b border-gray-100 bg-white px-4 shadow-sm sm:px-6">
      <Link to="/login" className="flex min-w-0 items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" aria-label="CareCompass home">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
          <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="16" cy="16" r="12" />
            <path d="M16 9v14M9 16h14" />
          </svg>
        </span>
        <span className="font-semibold text-gray-900">CareCompass</span>
      </Link>
      <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
        <InstallPwaButton />
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Account">
          <Link to="/login" className="font-semibold text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-600">Log in</Link>
          <Link to="/signup" className="hidden rounded-xl bg-brand-600 px-4 py-2 font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 sm:inline">Sign up</Link>
        </nav>
      </div>
      {error && <p role="alert" className="absolute inset-x-0 top-16 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    </header>
  )
}
