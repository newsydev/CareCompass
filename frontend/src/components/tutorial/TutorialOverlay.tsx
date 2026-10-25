import { useEffect, useRef, useState } from 'react'
import type { TourLang, TourStep } from './steps'
import { stepCounter, tourStrings } from './strings'

interface Box { top: number; left: number; width: number; height: number; hostHeight: number }

const PAD = 6
const btn = 'min-h-11 rounded-xl px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="h-5 w-5">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />}
    </svg>
  )
}

// Rendered inside the app column, which is `relative` with a transform: absolute inset-0 therefore
// matches the column exactly (position: fixed would also resolve against the transformed column).
export function TutorialOverlay({ target, step, index, total, language, muted, voiceNote, onNext, onBack, onSkip, onToggleMute }: {
  target: HTMLElement | null
  step: TourStep
  index: number
  total: number
  language: TourLang
  muted: boolean
  voiceNote: boolean
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onToggleMute: () => void
}) {
  const t = tourStrings[language]
  const root = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<Box | null>(null)
  const last = index === total - 1

  useEffect(() => {
    if (!target) return
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const host = root.current
        if (!host || !target.isConnected) return
        const h = host.getBoundingClientRect()
        const r = target.getBoundingClientRect()
        setBox({ top: r.top - h.top, left: r.left - h.left, width: r.width, height: r.height, hostHeight: h.height })
      })
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    measure()
    const timers = [200, 500, 900].map((ms) => window.setTimeout(measure, ms))
    window.addEventListener('resize', measure)
    document.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(frame)
      timers.forEach(window.clearTimeout)
      window.removeEventListener('resize', measure)
      document.removeEventListener('scroll', measure, true)
    }
  }, [target])

  useEffect(() => {
    if (target) card.current?.querySelector<HTMLElement>('[data-primary]')?.focus()
  }, [target, index])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onSkip(); return }
    if (e.key !== 'Tab' || !card.current) return
    const items = [...card.current.querySelectorAll<HTMLElement>('button:not([disabled])')]
    if (!items.length) return
    const first = items[0], end = items[items.length - 1]
    if (!card.current.contains(document.activeElement)) { e.preventDefault(); first.focus() }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus() }
    else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus() }
  }

  const cardAtTop = box ? box.top + box.height / 2 > box.hostHeight / 2 : false
  const visible = target !== null

  return (
    <div ref={root} onKeyDown={onKeyDown} className="absolute inset-0 z-[60] overflow-hidden">
      {visible && box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-2xl ring-2 ring-brand-400 transition-[top,left,width,height] duration-200 motion-reduce:transition-none"
          style={{
            top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgba(17, 24, 39, 0.65)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-gray-900/65" />
      )}

      {visible && (
        <div
          ref={card} role="dialog" aria-modal="true" aria-label={t.dialog}
          aria-labelledby="tour-title" aria-describedby="tour-body"
          className={`absolute inset-x-3 rounded-2xl bg-white p-4 shadow-xl ${cardAtTop ? 'top-4' : 'bottom-4'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{stepCounter(index, total, language)}</p>
            <button
              type="button" onClick={onToggleMute} aria-pressed={!muted}
              aria-label={muted ? t.unmute : t.mute} title={muted ? t.unmute : t.mute}
              className="flex h-11 w-11 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-600"
            >
              <SpeakerIcon muted={muted} />
            </button>
          </div>
          <h2 id="tour-title" lang={language} className="text-lg font-bold text-gray-900">{step.title[language]}</h2>
          <p id="tour-body" lang={language} className="mt-1 text-sm text-gray-700">{step.body[language]}</p>
          {voiceNote && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{t.noHindiVoice}</p>}
          <p role="status" aria-live="polite" className="sr-only">{`${stepCounter(index, total, language)}: ${step.title[language]}`}</p>
          <div className="mt-4 flex items-center gap-2">
            <button type="button" onClick={onSkip} className={`${btn} text-gray-700 hover:bg-gray-100`}>{t.skip}</button>
            <span className="flex-1" />
            <button type="button" onClick={onBack} disabled={index === 0} className={`${btn} border border-gray-300 text-gray-800 hover:bg-gray-50 disabled:border-gray-200 disabled:text-gray-500`}>
              {t.back}
            </button>
            <button type="button" data-primary onClick={onNext} className={`${btn} bg-brand-600 text-white hover:bg-brand-700`}>
              {last ? t.done : t.next}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
