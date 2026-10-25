import type { FollowUpAnswers, FollowUpQuestion, TriageResponse } from '../api/types'

export interface DraftAnswer {
  selected: string[]
  other: string
}
export type Draft = Record<string, DraftAnswer>

export const NONE_VALUE = 'none'
export const MAX_OTHER_LENGTH = 300

export function isFollowUpResponse(response: TriageResponse | null | undefined): response is TriageResponse & { questions: FollowUpQuestion[] } {
  return response?.action === 'ask_followup' && (response.questions?.length ?? 0) > 0
}

// Consecutive latest replies that were not symptom reports. After two, the page offers taps and the mic
// instead of repeating the same text.
export function offTopicStreak(turns: { role: string; result?: TriageResponse }[]) {
  let streak = 0
  for (let i = turns.length - 1; i >= 0; i--) {
    if (turns[i].role !== 'assistant') continue
    const intent = turns[i].result?.intent
    if (!intent || intent === 'symptom_report') break
    streak++
  }
  return streak
}

// A plain answer to a general question: shown as a chat reply, with no care card, caregivers or booking.
export function isInformational(response: TriageResponse | null | undefined) {
  return response?.action === 'answer' && !response.care_type && !response.assessment && !response.follow_up_question
}

export function emptyDraft(questions: FollowUpQuestion[]): Draft {
  return Object.fromEntries(questions.map((question) => [question.question_id, { selected: [], other: '' }]))
}

// Rebuild what the user picked from a saved answers payload (used to keep answers after a failed send).
export function draftFromAnswers(questions: FollowUpQuestion[], answers: FollowUpAnswers | undefined): Draft {
  const draft = emptyDraft(questions)
  for (const question of questions) {
    const raw = answers?.[question.question_id]
    if (raw === undefined) continue
    const values = Array.isArray(raw) ? raw : [raw]
    const known = new Set(question.options.map((option) => option.value))
    draft[question.question_id] = {
      selected: values.filter((value) => known.has(value)),
      other: values.filter((value) => !known.has(value)).join(', '),
    }
  }
  return draft
}

export function toggleChoice(question: FollowUpQuestion, current: DraftAnswer, value: string): DraftAnswer {
  if (question.input_type === 'single_choice') return { ...current, selected: [value] }
  if (current.selected.includes(value)) return { ...current, selected: current.selected.filter((item) => item !== value) }
  // "None of these" is exclusive: picking it clears the rest, and picking anything else clears it.
  const selected = value === NONE_VALUE ? [value] : [...current.selected.filter((item) => item !== NONE_VALUE), value]
  return { ...current, selected }
}

export function isAnswered(answer: DraftAnswer | undefined) {
  return !!answer && (answer.selected.length > 0 || answer.other.trim().length > 0)
}

export function canContinue(questions: FollowUpQuestion[], draft: Draft) {
  if (!questions.some((question) => isAnswered(draft[question.question_id]))) return false
  return questions.every((question) => !question.required || isAnswered(draft[question.question_id]))
}

export function buildAnswers(questions: FollowUpQuestion[], draft: Draft): FollowUpAnswers {
  const answers: FollowUpAnswers = {}
  for (const question of questions) {
    const answer = draft[question.question_id]
    if (!isAnswered(answer)) continue
    const other = answer.other.trim()
    if (question.input_type === 'multi_choice') answers[question.question_id] = other ? [...answer.selected, other] : answer.selected
    else answers[question.question_id] = answer.selected[0] ?? other
  }
  return answers
}

function phrasesFor(question: FollowUpQuestion, answer: DraftAnswer) {
  const byValue = new Map(question.options.map((option) => [option.value, option.text || option.label]))
  const phrases = answer.selected.map((value) => byValue.get(value) ?? value)
  if (answer.other.trim()) phrases.push(answer.other.trim())
  return phrases
}

// The user turn that goes into the conversation: safety and routing read this exactly like typed text.
export function composeAnswerText(questions: FollowUpQuestion[], draft: Draft) {
  return questions
    .filter((question) => isAnswered(draft[question.question_id]))
    .map((question) => `${question.summary_label}: ${phrasesFor(question, draft[question.question_id]).join(', ')}.`)
    .join(' ')
}

// An age implied by a chosen option (for example "older adult"), so the age question is not asked again.
export function ageHint(questions: FollowUpQuestion[], draft: Draft): number | undefined {
  for (const question of questions) {
    const picked = draft[question.question_id]?.selected ?? []
    for (const option of question.options) {
      if (picked.includes(option.value) && typeof option.age_years === 'number') return option.age_years
    }
  }
  return undefined
}
