import { Link } from 'react-router-dom'

const css = `
@keyframes cc-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes cc-spin{to{transform:rotate(360deg)}}
@keyframes cc-spin-rev{to{transform:rotate(-360deg)}}
@keyframes cc-pulse{0%,100%{transform:scale(1);opacity:.9}50%{transform:scale(1.12);opacity:1}}
@keyframes cc-dot{0%,100%{transform:translate(0,0);opacity:.5}50%{transform:translate(4px,-6px);opacity:1}}
.cc-orb{animation:cc-float 6s ease-in-out infinite}
.cc-o1{transform-origin:100px 100px;animation:cc-spin 28s linear infinite}
.cc-o2{transform-origin:100px 100px;animation:cc-spin-rev 22s linear infinite}
.cc-o3{transform-origin:100px 100px;animation:cc-spin 36s linear infinite}
.cc-core{transform-origin:100px 100px;animation:cc-pulse 4s ease-in-out infinite}
.cc-d{animation:cc-dot 5s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.cc-orb,.cc-o1,.cc-o2,.cc-o3,.cc-core,.cc-d{animation:none}}
`

const dots = [[40, 70, 3], [160, 60, 2.5], [150, 150, 3.5], [55, 145, 2.5], [100, 25, 2], [175, 105, 2]]

function Stethoscope() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3v6a4 4 0 0 0 8 0V3" />
      <path d="M9 13v2a5 5 0 0 0 10 0v-2" />
      <circle cx="19" cy="11" r="2" />
    </svg>
  )
}

export function OrbCard() {
  return (
    <section aria-labelledby="home-orb-title" className="flex flex-col items-center rounded-3xl border border-gray-200 bg-white px-6 py-8 text-center shadow-sm">
      <style>{css}</style>
      <svg viewBox="0 0 200 200" className="cc-orb size-56 max-w-full" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id="cc-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-brand-300)" stopOpacity="0.9" />
            <stop offset="60%" stopColor="var(--color-brand-100)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--color-brand-50)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="95" fill="url(#cc-glow)" opacity="0.5" />
        <path className="cc-o1" d="M100 18C140 16 182 52 182 100C182 146 142 184 98 182C54 180 18 144 20 98C22 54 60 20 100 18Z" fill="none" stroke="var(--color-brand-200)" strokeWidth="1.5" />
        <path className="cc-o2" d="M100 30C136 28 170 62 168 102C166 140 134 172 98 170C60 168 30 138 32 100C34 62 64 32 100 30Z" fill="none" stroke="var(--color-brand-300)" strokeWidth="1.5" />
        <path className="cc-o3" d="M100 44C128 46 154 70 152 100C150 130 128 156 98 156C68 156 46 130 48 100C50 72 74 42 100 44Z" fill="none" stroke="var(--color-brand-400)" strokeWidth="1.5" />
        {dots.map(([x, y, r], i) => (
          <circle key={i} className="cc-d" style={{ animationDelay: `${i * 0.7}s` }} cx={x} cy={y} r={r} fill="var(--color-brand-400)" />
        ))}
        <circle className="cc-core" cx="100" cy="100" r="30" fill="var(--color-brand-500)" opacity="0.9" />
        <circle cx="100" cy="100" r="18" fill="var(--color-brand-100)" opacity="0.9" />
      </svg>
      <h2 id="home-orb-title" className="mt-4 text-2xl font-semibold tracking-[0.2em] text-brand-700">CareCompass</h2>
      <p className="mt-2 text-xs font-medium uppercase tracking-[0.25em] text-gray-500">Ready to assist</p>
      <p className="mt-6 text-base text-gray-700">How are you feeling today?</p>
      <Link
        to="/triage"
        className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-600 px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        <Stethoscope />
        Start Consultation
      </Link>
    </section>
  )
}
