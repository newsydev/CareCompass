import { NavLink } from 'react-router-dom'

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

const sideLink = (isActive: boolean) =>
  `flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium transition ${isActive ? 'text-brand-600' : 'text-gray-500 hover:text-brand-600'}`

export function BottomNav() {
  return (
    <nav aria-label="Main" className="absolute inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-3 items-end">
        <li>
          <NavLink to="/home" className={({ isActive }) => sideLink(isActive)}>
            <svg {...svg} className="h-6 w-6">
              <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8.5z" />
            </svg>
            Home
          </NavLink>
        </li>
        <li className="flex justify-center">
          <NavLink
            to="/triage"
            aria-label="Consult"
            className={({ isActive }) => `-mt-6 flex flex-col items-center gap-1 text-xs font-medium ${isActive ? 'text-brand-600' : 'text-gray-500'}`}
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-white shadow-lg ring-4 ring-white transition hover:bg-brand-600 active:bg-brand-700">
              <svg {...svg} className="h-7 w-7">
                <path d="M6 3v6a4 4 0 0 0 8 0V3" />
                <path d="M10 13v2a5 5 0 0 0 10 0v-1" />
                <circle cx="20" cy="12" r="2" />
              </svg>
            </span>
            <span className="pb-2">Consult</span>
          </NavLink>
        </li>
        <li>
          <NavLink to="/partners" className={({ isActive }) => sideLink(isActive)}>
            <svg {...svg} className="h-6 w-6">
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
              <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.4c2 .8 3.5 2.6 3.5 5.6" />
            </svg>
            Partners
          </NavLink>
        </li>
      </ul>
    </nav>
  )
}
