import { Link } from 'react-router-dom'
import { OrbCard } from '../components/home/OrbCard'
import { TabHeader } from '../components/TabHeader'
import { VitalsSection } from '../components/VitalsSection'
import { getFirstName, getGreeting } from '../utils/greeting'
import type { DemoProfile } from '../utils/demoProfile'

export function HomePage({ profile }: { profile: DemoProfile }) {
  const first = getFirstName(profile.name)
  const initial = (first[0] ?? profile.email[0] ?? '?').toUpperCase()
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-gray-50">
      <TabHeader>
        <div className="flex items-center gap-3">
          <Link
            to="/profile"
            aria-label="Open your profile"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white ring-2 ring-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {initial}
          </Link>
          <h1 className="min-w-0 truncate text-2xl font-bold">{getGreeting()}{first ? `, ${first}` : ''}!</h1>
        </div>
      </TabHeader>
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        <OrbCard />
        <div className="mt-6">
          <div data-tour="vitals"><VitalsSection email={profile.email} /></div>
        </div>
      </div>
    </div>
  )
}
