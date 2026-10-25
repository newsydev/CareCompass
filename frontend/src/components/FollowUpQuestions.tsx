import { useId, useState } from 'react'
import type { FollowUpQuestion } from '../api/types'
import { MAX_OTHER_LENGTH, VISIBLE_OPTIONS, canContinue, toggleChoice, visibleOptions, type Draft } from '../utils/followUp'
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [otherOpen, setOtherOpen] = useState<Record<string, boolean>>({})
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
      className="flex flex-col gap-4"
    >
      {questions.map((question) => {
        const answer = draft[question.question_id] ?? { selected: [], other: '' }
        const multi = question.input_type === 'multi_choice'
        const name = `${baseId}-${question.question_id}`
        const isText = question.input_type === 'text'
        const shown = visibleOptions(question.options, expanded[question.question_id] === true, answer.selected)
        const canCollapse = question.options.length > VISIBLE_OPTIONS
        const showOther = isText || otherOpen[question.question_id] === true || answer.other.trim().length > 0
        const canOther = !isText && (question.allow_custom_input || question.options.length > VISIBLE_OPTIONS)
        return (
          <fieldset key={question.question_id} disabled={busy} className="min-w-0 border-0 p-0">
            <legend className="mb-2 text-[15px] font-semibold text-gray-900">
              {question.question_text}
              {question.required && <span className="ml-2 text-xs font-normal text-gray-600">{t.followUpRequired}</span>}
            </legend>
            {!isText && (
              <div className="grid gap-2">
                {shown.map((option, index) => {
                  const checked = answer.selected.includes(option.value)
                  return (
                    <label
                      key={option.value}
                      className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border bg-white px-3 py-2 text-[15px] text-gray-900 transition focus-within:outline-2 focus-within:outline-brand-600 ${
                        checked ? 'border-brand-600 ring-1 ring-brand-600' : 'border-gray-200 hover:border-brand-300'
                      }`}
                    >
                      <input
                        type={multi ? 'checkbox' : 'radio'}
                        name={name}
                        value={option.value}
                        checked={checked}
                        onChange={() => update(question.question_id, toggleChoice(question, answer, option.value))}
                        className="sr-only"
                      />
                      <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-base ${checked ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {checked ? '✓' : index + 1}
                      </span>
                      <span className="min-w-0 flex-1 break-words">{option.label}</span>
                    </label>
                  )
                })}
                {canCollapse && shown.length < question.options.length && (
                  <button type="button" onClick={() => setExpanded((current) => ({ ...current, [question.question_id]: true }))} className="min-h-11 rounded-2xl border border-dashed border-gray-300 px-3 text-sm font-medium text-brand-700">
                    {t.followUpMore} ({question.options.length - shown.length})
                  </button>
                )}
                {canCollapse && shown.length === question.options.length && expanded[question.question_id] === true && (
                  <button type="button" onClick={() => setExpanded((current) => ({ ...current, [question.question_id]: false }))} className="min-h-11 rounded-2xl border border-dashed border-gray-300 px-3 text-sm font-medium text-brand-700">
                    {t.followUpFewer}
                  </button>
                )}
                {canOther && !showOther && (
                  <button type="button" onClick={() => setOtherOpen((current) => ({ ...current, [question.question_id]: true }))} className="flex min-h-14 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-3 py-2 text-left text-[15px] text-gray-700 hover:border-brand-300">
                    <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">✎</span>
                    {t.followUpOtherRow}
                  </button>
                )}
              </div>
            )}
            {showOther && (
              <label className="mt-2 block text-xs text-gray-700">
                {isText ? t.followUpOtherRow : t.followUpOther}
                <input
                  type="text"
                  value={answer.other}
                  maxLength={MAX_OTHER_LENGTH}
                  autoFocus={!isText}
                  onChange={(event) => update(question.question_id, { ...answer, other: event.target.value })}
                  placeholder={t.followUpOtherPlaceholder}
                  className="mt-1 min-h-11 w-full rounded-2xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
                />
              </label>
            )}
          </fieldset>
        )
      })}

      {failed && !busy && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{t.followUpError}</p>}
      {!ready && !busy && <p id={`${baseId}-hint`} className="text-xs text-gray-600">{t.followUpNeedAnswer}</p>}
      <button
        type="submit"
        disabled={!ready || busy}
        aria-describedby={!ready && !busy ? `${baseId}-hint` : undefined}
        className="h-12 w-full rounded-2xl bg-brand-600 px-5 text-base font-semibold text-white transition hover:bg-brand-700 active:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? t.followUpSending : t.followUpContinue}
      </button>
    </form>
  )
}
