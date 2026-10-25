import type { VoicePhase } from './sessionState'

const css = `
@keyframes vo-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes vo-pulse{0%{transform:scale(.9);opacity:.7}100%{transform:scale(1.45);opacity:0}}
@keyframes vo-spin{to{transform:rotate(360deg)}}
.vo-core{transform-origin:100px 100px}
.vo-idle .vo-core{animation:vo-breathe 6s ease-in-out infinite}
.vo-speaking .vo-core{animation:vo-breathe 1.2s ease-in-out infinite}
.vo-listening .vo-ring{transform-origin:100px 100px;animation:vo-pulse 1.8s ease-out infinite}
.vo-listening .vo-ring2{animation-delay:.9s}
.vo-thinking .vo-orbit{transform-origin:100px 100px;animation:vo-spin 2.4s linear infinite}
@media (prefers-reduced-motion:reduce){.vo-core,.vo-ring,.vo-orbit{animation:none!important}}
`

export function VoiceOrb({ phase }: { phase: VoicePhase }) {
  const mode = phase === 'greeting' ? 'speaking' : phase === 'error' || phase === 'done' ? 'idle' : phase
  return (
    <div className={`vo-${mode} mx-auto size-44 max-w-full`} aria-hidden="true">
      <style>{css}</style>
      <svg viewBox="0 0 200 200" className="size-full" focusable="false">
        <circle className="vo-ring" cx="100" cy="100" r="46" fill="none" stroke="var(--color-brand-300)" strokeWidth="3" opacity="0" />
        <circle className="vo-ring vo-ring2" cx="100" cy="100" r="46" fill="none" stroke="var(--color-brand-400)" strokeWidth="3" opacity="0" />
        <circle cx="100" cy="100" r="82" fill="var(--color-brand-100)" opacity="0.6" />
        <g className="vo-orbit">
          <circle cx="100" cy="100" r="66" fill="none" stroke="var(--color-brand-300)" strokeWidth="2" strokeDasharray="6 10" />
          <circle cx="100" cy="34" r="5" fill="var(--color-brand-500)" />
        </g>
        <circle className="vo-core" cx="100" cy="100" r="40" fill="var(--color-brand-500)" />
        <circle cx="100" cy="100" r="22" fill="var(--color-brand-100)" opacity="0.9" />
      </svg>
    </div>
  )
}
