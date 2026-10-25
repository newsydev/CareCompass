import { Link } from 'react-router-dom'
import { OrbCard } from '../components/home/OrbCard'
import { VitalsSection } from '../components/VitalsSection'
import { getFirstName, getGreeting } from '../utils/greeting'
import type { DemoProfile } from '../utils/demoProfile'

export function HomePage({ profile }: { profile: DemoProfile }) {
  const first = getFirstName(profile.name)
  const initial = (first[0] ?? profile.email[0] ?? '?').toUpperCase()
  return (
    <div className="h-full overflow-y-auto bg-gray-50 px-4 pb-28 pt-4">
      <header className="mb-4 flex items-center gap-3">
        <Link
          to="/profile"
          aria-label="Open your profile"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {initial}
        </Link>
        <div className="min-w-0">
          <p className="truncate text-sm text-gray-500">{getGreeting()}{first ? `, ${first}` : ''}!</p>
          <h1 className="text-lg font-bold leading-tight text-gray-900">Your health companion is here</h1>
        </div>
      </header>
      <OrbCard />
      <div className="mt-4">
        <VitalsSection email={profile.email} />
      </div>
    </div>
  )
}
