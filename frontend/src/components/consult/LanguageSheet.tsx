import { Sheet } from '../profile/Sheet'
import { consultStrings as t } from './strings'
import type { UiLanguage } from '../../utils/i18n'

const OPTIONS: { code: UiLanguage; label: string; hint: string }[] = [
  { code: 'en', label: t.english, hint: t.englishHint },
  { code: 'hi', label: t.hindi, hint: t.hindiHint },
]

export function LanguageSheet({ onChoose, onClose }: { onChoose: (language: UiLanguage) => void; onClose: () => void }) {
  return (
    <Sheet title={t.sheetTitle} onClose={onClose}>
      <div className="mt-4 flex flex-col gap-3">
        {OPTIONS.map((option) => (
          <button
            key={option.code} type="button" lang={option.code} onClick={() => onChoose(option.code)}
            className="flex min-h-20 items-center justify-between rounded-2xl border border-gray-300 px-4 py-3 text-left transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <span>
              <span className="block text-2xl font-bold text-gray-900">{option.label}</span>
              <span className="block text-sm text-gray-600">{option.hint}</span>
            </span>
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-700 text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" />
              </svg>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm text-gray-600">{t.sheetNote}</p>
    </Sheet>
  )
}
