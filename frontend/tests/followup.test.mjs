import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

function load(path, requireMap = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  })
  const module = { exports: {} }
  runInNewContext(outputText, { module, exports: module.exports, require: (name) => requireMap[name] ?? {} })
  return module.exports
}

const plain = (value) => JSON.parse(JSON.stringify(value))
const followUp = load('../src/utils/followUp.ts')
const { describeResponse } = load('../src/utils/chatSummary.ts', {
  './humanize': { humanizeSlug: (value) => value.replaceAll('_', ' ') },
})

const duration = {
  question_id: 'duration', question_text: 'How long?', summary_label: 'Duration', input_type: 'single_choice',
  required: true, allow_custom_input: true,
  options: [
    { value: 'today', label: 'Since today', text: 'since today' },
    { value: 'since_yesterday', label: 'Since yesterday', text: 'since yesterday' },
  ],
}
const patient = {
  question_id: 'patient', question_text: 'Who is it for?', summary_label: 'Patient', input_type: 'single_choice',
  required: true, allow_custom_input: false,
  options: [{ value: 'self', label: 'Myself', text: 'patient is myself' }, { value: 'older_adult', label: 'Older adult', text: 'patient is an older adult over 65', age_years: 65 }],
}
const associated = {
  question_id: 'associated', question_text: 'Anything else?', summary_label: 'Associated symptoms', input_type: 'multi_choice',
  required: false, allow_custom_input: true,
  options: [
    { value: 'stiff_neck', label: 'Stiff neck', text: 'stiff neck' },
    { value: 'confusion', label: 'New confusion', text: 'new confusion' },
    { value: 'none', label: 'None of these', text: 'none of the listed signs' },
  ],
}

test('continue is blocked until a required question is answered', () => {
  const questions = [duration, patient]
  let draft = followUp.emptyDraft(questions)
  assert.equal(followUp.canContinue(questions, draft), false)
  draft = { ...draft, duration: followUp.toggleChoice(duration, draft.duration, 'today') }
  assert.equal(followUp.canContinue(questions, draft), false) // patient still missing
  draft = { ...draft, patient: followUp.toggleChoice(patient, draft.patient, 'self') }
  assert.equal(followUp.canContinue(questions, draft), true)
})

test('an optional question alone can continue only when something is answered', () => {
  const draft = followUp.emptyDraft([associated])
  assert.equal(followUp.canContinue([associated], draft), false)
  assert.equal(followUp.canContinue([associated], { associated: { selected: [], other: 'ear pain' } }), true)
})

test('single choice replaces the earlier pick and answers can be edited before continuing', () => {
  let answer = followUp.toggleChoice(duration, { selected: [], other: '' }, 'today')
  answer = followUp.toggleChoice(duration, answer, 'since_yesterday')
  assert.deepEqual(plain(answer.selected), ['since_yesterday'])
})

test('multi choice toggles, and "none" is exclusive in both directions', () => {
  let answer = { selected: [], other: '' }
  answer = followUp.toggleChoice(associated, answer, 'stiff_neck')
  answer = followUp.toggleChoice(associated, answer, 'confusion')
  assert.deepEqual(plain(answer.selected), ['stiff_neck', 'confusion'])
  answer = followUp.toggleChoice(associated, answer, 'none')
  assert.deepEqual(plain(answer.selected), ['none'])
  answer = followUp.toggleChoice(associated, answer, 'stiff_neck')
  assert.deepEqual(plain(answer.selected), ['stiff_neck'])
  answer = followUp.toggleChoice(associated, answer, 'stiff_neck')
  assert.deepEqual(plain(answer.selected), [])
})

test('answers are composed into the clinical sentence the backend screens for safety', () => {
  const questions = [duration, associated]
  const draft = {
    duration: { selected: ['since_yesterday'], other: '' },
    associated: { selected: ['stiff_neck', 'confusion'], other: 'light hurts' },
  }
  assert.equal(
    followUp.composeAnswerText(questions, draft),
    'Duration: since yesterday. Associated symptoms: stiff neck, new confusion, light hurts.',
  )
})

test('unanswered optional questions are left out of the text and the payload', () => {
  const questions = [duration, associated]
  const draft = { duration: { selected: ['today'], other: '' }, associated: { selected: [], other: '' } }
  assert.equal(followUp.composeAnswerText(questions, draft), 'Duration: since today.')
  assert.deepEqual(plain(followUp.buildAnswers(questions, draft)), { duration: 'today' })
})

test('payload uses a string for single choice and an array for multi choice, with custom text kept', () => {
  const questions = [duration, associated]
  const draft = {
    duration: { selected: [], other: 'since last week' },
    associated: { selected: ['none'], other: '' },
  }
  assert.deepEqual(plain(followUp.buildAnswers(questions, draft)), { duration: 'since last week', associated: ['none'] })
  assert.equal(followUp.composeAnswerText(questions, draft), 'Duration: since last week. Associated symptoms: none of the listed signs.')
})

test('a failed send restores the user answers instead of losing them', () => {
  const questions = [duration, associated]
  const draft = followUp.draftFromAnswers(questions, { duration: 'since_yesterday', associated: ['stiff_neck', 'ear pain'] })
  assert.deepEqual(plain(draft.duration), { selected: ['since_yesterday'], other: '' })
  assert.deepEqual(plain(draft.associated), { selected: ['stiff_neck'], other: 'ear pain' })
})

test('an option that implies an age gives an age hint so age is not asked again', () => {
  const draft = { patient: { selected: ['older_adult'], other: '' } }
  assert.equal(followUp.ageHint([patient], draft), 65)
  assert.equal(followUp.ageHint([patient], { patient: { selected: ['self'], other: '' } }), undefined)
})

test('responses are classified: follow-up card, informational reply, or full result', () => {
  const ask = { action: 'ask_followup', questions: [duration], follow_up_question: 'x', care_type: null }
  const info = { action: 'answer', message: 'A fever is...', questions: [], follow_up_question: null, care_type: null, assessment: null }
  const routed = { action: 'answer', questions: [], follow_up_question: null, care_type: 'teleconsultation', assessment: { level: 'self_care_support' } }
  const legacy = { follow_up_question: 'Tell me more', care_type: null }
  assert.equal(followUp.isFollowUpResponse(ask), true)
  assert.equal(followUp.isFollowUpResponse({ ...ask, questions: [] }), false)
  assert.equal(followUp.isInformational(info), true)
  assert.equal(followUp.isInformational(routed), false)
  assert.equal(followUp.isInformational(legacy), false)
  assert.equal(followUp.isFollowUpResponse(legacy), false)
})

test('chat text for an informational answer is the answer itself, not an emergency or care card', () => {
  const info = { action: 'answer', message: 'A fever is a rise in temperature.', follow_up_question: null, care_type: null, red_flags: [], assessment: null }
  assert.equal(describeResponse(info), 'A fever is a rise in temperature.')
  const ask = { action: 'ask_followup', message: 'I need a little more information.', follow_up_question: 'I need a little more information.', care_type: null, red_flags: [] }
  assert.equal(describeResponse(ask), 'I need a little more information.')
})

test('two consecutive off-topic replies trigger the tap/mic shortcuts; a symptom reply resets the count', () => {
  const user = { role: 'user' }
  const off = (intent) => ({ role: 'assistant', result: { intent } })
  assert.equal(followUp.offTopicStreak([user, off('out_of_scope')]), 1)
  assert.equal(followUp.offTopicStreak([user, off('greeting'), user, off('gibberish')]), 2)
  assert.equal(followUp.offTopicStreak([user, off('out_of_scope'), user, off('symptom_report')]), 0)
  assert.equal(followUp.offTopicStreak([user, off('out_of_scope'), user, { role: 'assistant', result: { intent: null } }]), 0)
  assert.equal(followUp.offTopicStreak([]), 0)
})
