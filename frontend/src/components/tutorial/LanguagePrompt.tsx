import { Sheet } from '../profile/Sheet'
import type { TourLang } from './steps'
import { tourStrings } from './strings'

const choiceClass = 'flex min-h-14 items-center justify-between rounded-xl border border-gray-300 px-4 py-3 text-left text-lg font-semibold text-gray-900 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

export function LanguagePrompt({ onChoose, onClose }: { onChoose: (language: TourLang) => void; onClose: () => void }) {
  const t = tourStrings.en
  return (
    <Sheet title={t.promptTitle} onClose={onClose}>
      <p className="mt-1 text-sm text-gray-600">{t.promptHint}</p>
      <div className="mt-4 flex flex-col gap-2">
        <button type="button" onClick={() => onChoose('en')} className={choiceClass}>{t.english}</button>
        <button type="button" lang="hi" onClick={() => onChoose('hi')} className={choiceClass}>{t.hindi}</button>
      </div>
      <button type="button" onClick={onClose} className="mt-3 min-h-11 w-full rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-600">
        {t.cancel}
      </button>
    </Sheet>
  )
}
