import { useEffect, useRef } from 'react'
import type { CrisisInfo } from '../../api/types'
import { crisisHelplines, telHref } from '../../utils/crisis'
import type { UiLanguage } from '../../utils/i18n'
import { startAlertVibration } from '../../utils/vibrate'
import { emergencyStrings } from './strings'

const callClass = 'flex min-h-14 w-full items-center justify-center rounded-2xl px-4 py-3 text-center text-lg font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function EmergencyAlert({ language, crisis, onDismiss }: {
  language: UiLanguage
  crisis?: CrisisInfo | boolean | null
  onDismiss: () => void
}) {
  const t = emergencyStrings(language)
  const firstCall = useRef<HTMLAnchorElement>(null)
  const isCrisis = Boolean(crisis)
  const lines = crisisHelplines(typeof crisis === 'object' ? crisis : null)
  const [emergencyLine, ...rest] = lines
  const extra = isCrisis ? rest : rest.filter((line) => line.number === '102')

  useEffect(() => {
    firstCall.current?.focus()
    return startAlertVibration()
  }, [])

  return (
    <div
      role="alert" aria-live="assertive" aria-label={t.alertLabel} lang={language}
      className="sticky top-0 z-20 border-b-4 border-red-900 bg-red-700 px-4 py-4 text-white shadow-lg"
    >
      <h2 className="text-xl font-bold leading-tight">{isCrisis ? t.crisisHeadline : t.headline}</h2>
      <p className="mt-1 text-base">{isCrisis ? t.crisisBody : t.body}</p>
      <div className="mt-3 flex flex-col gap-2">
        <a ref={firstCall} href={telHref(emergencyLine.number)} className={`${callClass} bg-white text-red-800 hover:bg-red-50`}>
          {t.call112}
        </a>
        {extra.map((line) => {
          const key = line.number.replace(/[^\d+]/g, '')
          const label = line.number === '102' ? t.call102 : t.callLine(t.names[key] ?? line.name, line.number)
          return (
            <a key={key} href={telHref(line.number)} className={`${callClass} border-2 border-white text-white hover:bg-red-800`}>
              {label}
            </a>
          )
        })}
      </div>
      <p className="mt-3 text-sm">{t.honest}</p>
      <button
        type="button" onClick={onDismiss}
        className="mt-3 min-h-11 w-full rounded-xl border border-red-200 px-4 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {t.dismiss}
      </button>
    </div>
  )
}
