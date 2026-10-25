import { Sheet } from '../profile/Sheet'
import { focusRing } from '../profile/styles'
import type { UiLanguage } from '../../utils/i18n'
import { voiceStrings } from './strings'

export function VoiceLanguageSheet({ onPick, onClose }: { onPick: (language: UiLanguage) => void; onClose: () => void }) {
  const t = voiceStrings('en')
  const options: [UiLanguage, string, string][] = [
    ['en', t.langEnglish, t.langEnglishHint],
    ['hi', t.langHindi, t.langHindiHint],
  ]
  return (
    <Sheet title={`${t.langTitle} / ${voiceStrings('hi').langTitle}`} onClose={onClose}>
      <div role="group" aria-label={t.langTitle} className="mt-4 flex flex-col gap-3">
        {options.map(([code, label, hint]) => (
          <button
            key={code} type="button" onClick={() => onPick(code)} lang={code}
            className={`rounded-2xl border border-gray-300 px-4 py-4 text-left transition hover:bg-brand-50 ${focusRing}`}
          >
            <span className="block text-2xl font-bold text-gray-900">{label}</span>
            <span className="block text-sm text-gray-600">{hint}</span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-gray-600">{t.langNote}</p>
    </Sheet>
  )
}
