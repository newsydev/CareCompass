import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { TutorialContext } from '../../hooks/useTutorial'
import { LanguagePrompt } from './LanguagePrompt'
import { TutorialOverlay } from './TutorialOverlay'
import { narrate, stopNarration, voiceLangs } from './narrate'
import { TOUR_STEPS, type TourLang } from './steps'
import { localeFor, narrationText, routeMatches, stepAfter, targetSelector } from './tourLogic'

const MUTE_KEY = 'carecompass.tour.muted'
const POLL_MS = 100
const POLL_LIMIT = 15

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const [promptOpen, setPromptOpen] = useState(false)
  const [language, setLanguage] = useState<TourLang | null>(null)
  const [index, setIndex] = useState(0)
  const [found, setFound] = useState<{ index: number; el: HTMLElement } | null>(null)
  const [muted, setMuted] = useState(readMuted)
  const [voices, setVoices] = useState<string[]>(voiceLangs)
  const direction = useRef<1 | -1>(1)
  const misses = useRef(0)
  const origin = useRef('/home')
  const pathnameRef = useRef(pathname)
  const here = `${pathname}${search}`

  const navigateRef = useRef(navigate)
  useEffect(() => {
    pathnameRef.current = pathname
    navigateRef.current = navigate
  }, [pathname, navigate])

  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const update = () => setVoices(voiceLangs())
    window.speechSynthesis.addEventListener('voiceschanged', update)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update)
  }, [])

  useEffect(() => () => stopNarration(), [])

  const finish = useCallback((to: string) => {
    stopNarration()
    setLanguage(null)
    setFound(null)
    navigateRef.current(to)
  }, [])

  // Go to the step's page, then wait for its target to mount. A missing target skips that step.
  useEffect(() => {
    if (!language) return
    const step = TOUR_STEPS[index]
    if (!routeMatches(pathnameRef.current, step.route)) navigateRef.current(step.route)
    let tries = 0
    const timer = window.setInterval(() => {
      const el = routeMatches(pathnameRef.current, step.route)
        ? document.querySelector<HTMLElement>(targetSelector(step)) : null
      if (el) {
        window.clearInterval(timer)
        misses.current = 0
        setFound({ index, el })
        return
      }
      if (++tries < POLL_LIMIT) return
      window.clearInterval(timer)
      misses.current += 1
      if (misses.current >= TOUR_STEPS.length) { finish('/home'); return }
      const next = stepAfter(index, direction.current, TOUR_STEPS.length)
      if (next !== null) setIndex(next)
      else if (direction.current === 1) finish('/home')
      else { direction.current = 1; setIndex(index + 1) }
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [language, index, finish])

  const target = language !== null && found?.index === index ? found.el : null
  useEffect(() => {
    if (!target || !language) return
    if (muted) stopNarration()
    else narrate(narrationText(TOUR_STEPS[index], language), localeFor(language))
  }, [target, language, index, muted])

  const api = useMemo(() => ({
    start: () => {
      if (language) return
      origin.current = here
      setPromptOpen(true)
    },
    active: language !== null,
  }), [language, here])

  function choose(next: TourLang) {
    setPromptOpen(false)
    direction.current = 1
    misses.current = 0
    setFound(null)
    setIndex(0)
    setLanguage(next)
  }

  function move(delta: 1 | -1) {
    direction.current = delta
    const next = stepAfter(index, delta, TOUR_STEPS.length)
    if (next === null) {
      if (delta === 1) finish('/home')
      return
    }
    stopNarration()
    setFound(null)
    setIndex(next)
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    try {
      localStorage.setItem(MUTE_KEY, next ? '1' : '0')
    } catch {
      // Preference is optional; private browsing may block storage.
    }
  }

  const voiceNote = language === 'hi' && voices.length > 0 && !voices.some((lang) => lang.startsWith('hi'))

  return (
    <TutorialContext.Provider value={api}>
      {children}
      {promptOpen && <LanguagePrompt onChoose={choose} onClose={() => setPromptOpen(false)} />}
      {language && (
        <TutorialOverlay
          target={target}
          step={TOUR_STEPS[index]} index={index} total={TOUR_STEPS.length} language={language}
          muted={muted} voiceNote={voiceNote}
          onNext={() => move(1)} onBack={() => move(-1)}
          onSkip={() => finish(origin.current)} onToggleMute={toggleMute}
        />
      )}
    </TutorialContext.Provider>
  )
}
