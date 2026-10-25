import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { EmergencyAlert } from '../components/emergency/EmergencyAlert'
import { focusRing } from '../components/profile/styles'
import { SubPageHeader } from '../components/profile/SubPageHeader'
import { phaseLabelKey } from '../components/voice/sessionState'
import { voiceStrings } from '../components/voice/strings'
import { VoiceLanguageSheet } from '../components/voice/VoiceLanguageSheet'
import { VoiceOrb } from '../components/voice/VoiceOrb'
import { useVoiceSession } from '../hooks/useVoiceSession'
import { useDemoSession } from '../hooks/useDemoSession'
import { consultPath, readConsultLang } from '../utils/consultLang'
import type { DemoProfile } from '../utils/demoProfile'
import type { UiLanguage } from '../utils/i18n'

type ControlKind = 'mic' | 'pause' | 'send' | 'skip'

function ControlIcon({ kind }: { kind: ControlKind }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="size-7">
      {kind === 'pause' && (
        <>
          <path d="M8 5v14" />
          <path d="M16 5v14" />
        </>
      )}
      {kind === 'send' && <path d="m22 2-7 20-4-9-9-4zM22 2 11 13" />}
      {kind === 'skip' && <path d="m5 4 10 8-10 8zM19 5v14" />}
      {kind === 'mic' && (
        <>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
        </>
      )}
    </svg>
  )
}

function VoiceSession({ initialLanguage, profile }: { initialLanguage: UiLanguage; profile: DemoProfile }) {
  const [language, setLanguage] = useState(initialLanguage)
  const navigate = useNavigate()
  const t = voiceStrings(language)
  const { state, voiceNote, pause, resume, retry, handoff, sendNow, skipSpeech, alert, dismissAlert } = useVoiceSession(language, profile)
  const { phase } = state
  const label = phase === 'error' ? t.error : t[phaseLabelKey(phase)]
  const micBlocked = phase === 'error' && state.errorKind === 'mic'
  const hasWords = state.transcript.trim().length > 0
  // One big button that always does the useful thing for the current phase.
  const control: { kind: ControlKind; label: string; run: () => void } =
    phase === 'listening' && hasWords ? { kind: 'send', label: t.sendNow, run: sendNow }
    : phase === 'listening' || phase === 'thinking' ? { kind: 'pause', label: t.pause, run: pause }
    : phase === 'speaking' || phase === 'greeting' ? { kind: 'skip', label: t.skip, run: skipSpeech }
    : { kind: 'mic', label: t.resume, run: resume }

  return (
    <section lang={language} className="flex h-full flex-col bg-gradient-to-b from-brand-50 to-white" aria-label={t.title}>
      <SubPageHeader
        title={t.title} backLabel={t.back} onBack={() => navigate('/consult')}
        action={(
          <>
            <div role="group" aria-label={t.languageSwitch} className="flex shrink-0 overflow-hidden rounded-full border border-gray-300 bg-white text-sm font-semibold">
              {([['en', 'EN'], ['hi', 'हिं']] as [UiLanguage, string][]).map(([code, text]) => (
                <button
                  key={code} type="button" lang={code} aria-pressed={language === code} disabled={phase === 'done'}
                  onClick={() => setLanguage(code)}
                  className={`min-h-10 min-w-10 px-2.5 ${focusRing} ${language === code ? 'bg-brand-600 text-white' : 'text-gray-800 hover:bg-gray-50'}`}
                >
                  {text}
                </button>
              ))}
            </div>
            <button
              type="button" onClick={() => { void handoff() }} disabled={phase === 'done'}
              className={`min-h-10 shrink-0 rounded-full border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:text-gray-500 ${focusRing}`}
            >
              {t.end}
            </button>
          </>
        )}
      />

      {alert && <div className="max-h-[60%] shrink-0 overflow-y-auto"><EmergencyAlert language={language} crisis={alert.crisis} onDismiss={dismissAlert} /></div>}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 pt-4">
        <VoiceOrb phase={phase} />
        <p role="status" aria-live="polite" className="mt-3 text-center text-base font-semibold text-brand-800">{label}</p>

        {voiceNote === 'missing' && (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t.noVoice}</p>
        )}

        <div className="mx-auto mt-4 flex max-w-md flex-col gap-3">
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{t.you}</p>
            <p className="mt-1 min-h-6 break-words text-base text-gray-900">
              {state.transcript || (phase === 'listening'
                ? <span className="animate-pulse font-semibold text-brand-700">{t.listening}</span>
                : <span className="text-gray-500">{t.placeholderYou}</span>)}
            </p>
            {phase === 'idle' && state.notice === 'noSpeech' && (
              <p role="status" className="mt-2 text-sm font-medium text-amber-900">{t.didntHear}</p>
            )}
          </div>
          {state.reply && (
            <div className="rounded-2xl bg-brand-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-800">{t.assistant}</p>
              <p className="mt-1 whitespace-pre-line break-words text-base text-brand-900">{state.reply}</p>
            </div>
          )}
          {phase === 'error' && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <p>{state.errorMessage}</p>
              {!micBlocked && (
                <button type="button" onClick={retry} className={`mt-3 min-h-11 rounded-xl bg-red-700 px-4 font-semibold text-white hover:bg-red-800 ${focusRing}`}>
                  {t.retry}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 bg-white px-4 pb-3 pt-3">
        <div className="mx-auto flex max-w-md items-center justify-center gap-4">
          <button
            type="button" onClick={() => { void handoff() }} disabled={phase === 'done'}
            className={`min-h-12 flex-1 rounded-2xl border border-brand-600 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:border-gray-300 disabled:text-gray-500 ${focusRing}`}
          >
            {t.switchChat}
          </button>
          <button
            type="button" disabled={phase === 'done' || micBlocked}
            onClick={control.run}
            aria-label={control.label} title={control.label}
            className={`flex size-16 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition disabled:bg-gray-300 ${
              phase === 'listening' ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
            } ${focusRing}`}
          >
            <ControlIcon kind={control.kind} />
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-600">{t.disclaimer}</p>
      </div>
    </section>
  )
}

export function VoiceConsultPage() {
  const { profile } = useDemoSession()
  const { search } = useLocation()
  const navigate = useNavigate()
  const language = readConsultLang(search)

  if (!profile) return <Navigate to="/login" replace />
  if (!language) {
    return (
      <VoiceLanguageSheet
        onPick={(picked) => navigate(consultPath(picked, 'voice'), { replace: true })}
        onClose={() => navigate('/home', { replace: true })}
      />
    )
  }
  return <VoiceSession initialLanguage={language} profile={profile} />
}
