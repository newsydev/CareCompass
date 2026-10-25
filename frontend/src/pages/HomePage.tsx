import type { DemoProfile } from '../utils/demoProfile'

// Placeholder: replaced by the Home page agent.
export function HomePage({ profile }: { profile: DemoProfile }) {
  return <div className="h-full overflow-y-auto p-4">Home {profile.name}</div>
}
