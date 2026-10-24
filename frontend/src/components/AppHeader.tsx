import { Link } from 'react-router-dom'
import { useDemoSession } from '../hooks/useDemoSession'
import { InstallPwaButton } from './InstallPwaButton'

export function AppHeader() {
  const { profile, logout, error, busy, saving } = useDemoSession()
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6">
      <Link to={profile ? '/triage' : '/login'} className="flex min-w-0 items-center gap-2" aria-label="CareCompass home">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white">
          <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="16" cy="16" r="12" />
            <path d="M16 9v14M9 16h14" />
          </svg>
        </span>
        <span className="font-semibold text-gray-900">CareCompass</span>
        <span className="hidden rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800 sm:inline">Demo</span>
      </Link>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3 text-sm">
        <InstallPwaButton />
        <nav className="flex items-center gap-2 sm:gap-3 text-sm" aria-label="Account">
        {profile ? (
          <>
            <Link to="/profile" className="flex items-center gap-2 font-medium text-gray-700" aria-label={`${profile.name} profile`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-700">{profile.name.charAt(0).toUpperCase()}</span>
              <span className="hidden max-w-32 truncate sm:inline">{profile.name}</span>
            </Link>
            <button type="button" onClick={logout} disabled={busy || saving} className="rounded-lg border border-gray-200 px-3 py-2 disabled:opacity-50">Log out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="font-medium text-brand-600">Log in</Link>
            <Link to="/signup" className="hidden rounded-lg bg-brand-500 px-3 py-2 text-white sm:inline">Sign up</Link>
          </>
        )}
      </nav>
      </div>
      {error && <p role="alert" className="absolute inset-x-0 top-16 border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
    </header>
  )
}
