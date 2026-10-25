import { useId, useState } from 'react'
import type { FollowUpQuestion } from '../api/types'
import { MAX_OTHER_LENGTH, canContinue, toggleChoice, type Draft } from '../utils/followUp'
import { STRINGS, type UiLanguage } from '../utils/i18n'

interface FollowUpQuestionsProps {
  questions: FollowUpQuestion[]
  initialDraft: Draft
  busy: boolean
  failed: boolean
  language: UiLanguage
  onSubmit: (draft: Draft) => void
}

export function FollowUpQuestions({ questions, initialDraft, busy, failed, language, onSubmit }: FollowUpQuestionsProps) {
  const t = STRINGS[language]
  const baseId = useId()
  const [draft, setDraft] = useState<Draft>(initialDraft)
  const ready = canContinue(questions, draft)

  function update(id: string, next: Draft[string]) {
    setDraft((current) => ({ ...current, [id]: next }))
  }

  return (
    <form
      aria-label={t.followUpLabel}
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault()
        if (ready && !busy) onSubmit(draft)
      }}
      className="rounded-xl border border-brand-200 bg-brand-50 p-4 sm:p-5"
    >
      <div className="flex flex-col gap-5">
        {questions.map((question) => {
          const answer = draft[question.question_id] ?? { selected: [], other: '' }
          const multi = question.input_type === 'multi_choice'
          const name = `${baseId}-${question.question_id}`
          return (
            <fieldset key={question.question_id} disabled={busy} className="min-w-0 border-0 p-0">
              <legend className="text-sm font-semibold text-gray-900">
                {question.question_text}
                {question.required && <span className="ml-2 text-xs font-normal text-gray-500">{t.followUpRequired}</span>}
              </legend>
              {question.input_type !== 'text' && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {question.options.map((option) => {
                    const checked = answer.selected.includes(option.value)
                    return (
                      <label
                        key={option.value}
                        className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                          checked ? 'border-brand-500 bg-white text-gray-900 ring-1 ring-brand-500' : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300'
                        }`}
                      >
                        <input
                          type={multi ? 'checkbox' : 'radio'}
                          name={name}
                          value={option.value}
                          checked={checked}
                          onChange={() => update(question.question_id, toggleChoice(question, answer, option.value))}
                          className="h-4 w-4 shrink-0 accent-brand-500"
                        />
                        <span>{option.label}</span>
                      </label>
                    )
                  })}
                </div>
              )}
              {(question.allow_custom_input || question.input_type === 'text') && (
                <label className="mt-2 block text-xs text-gray-600">
                  {t.followUpOther}
                  <input
                    type="text"
                    value={answer.other}
                    maxLength={MAX_OTHER_LENGTH}
                    onChange={(event) => update(question.question_id, { ...answer, other: event.target.value })}
                    placeholder={t.followUpOtherPlaceholder}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                  />
                </label>
              )}
            </fieldset>
          )
        })}
      </div>

      {failed && !busy && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{t.followUpError}</p>}
      {!ready && !busy && <p id={`${baseId}-hint`} className="mt-3 text-xs text-gray-500">{t.followUpNeedAnswer}</p>}
      <button
        type="submit"
        disabled={!ready || busy}
        aria-describedby={!ready && !busy ? `${baseId}-hint` : undefined}
        className="mt-4 h-11 rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white transition hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? t.followUpSending : t.followUpContinue}
      </button>
    </form>
  )
}
