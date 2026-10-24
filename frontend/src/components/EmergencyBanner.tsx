import { humanizeSlug } from '../utils/humanize'

interface EmergencyBannerProps {
  redFlags: string[]
  reasoning: string | null
}

export function EmergencyBanner({ redFlags, reasoning }: EmergencyBannerProps) {
  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6" role="alert">
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden="true">
          🚨
        </span>
        <div>
          <h2 className="text-xl font-bold text-red-700">This looks like an emergency</h2>
          <p className="mt-1 text-red-700">
            Please call for help immediately. Do not wait for a caregiver match.
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href="tel:112"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-4 text-lg font-bold text-white transition hover:bg-red-700"
        >
          📞 Call 112 Now
        </a>
        <a
          href="tel:102"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-red-600 px-4 py-4 text-lg font-bold text-red-700 transition hover:bg-red-100"
        >
          🚑 Call Ambulance (102)
        </a>
      </div>

      {redFlags.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-red-700">Detected red flags:</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {redFlags.map((flag) => (
              <li
                key={flag}
                className="rounded-full border border-red-300 bg-white px-3 py-1 text-sm text-red-700"
              >
                {humanizeSlug(flag)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reasoning && <p className="mt-4 text-sm text-red-700/90">{reasoning}</p>}
    </div>
  )
}
