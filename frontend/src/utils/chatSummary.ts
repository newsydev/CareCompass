import type { TriageResponse } from '../api/types'
import { humanizeSlug } from './humanize'

export function describeResponse(response: TriageResponse) {
  if (response.follow_up_question) return response.follow_up_question
  const assessment = response.assessment
  const emergency = response.care_type === 'emergency_112' || response.urgency === 'emergency' ||
    response.red_flags.length > 0 || assessment?.level === 'emergency'
  const lines = emergency
    ? ['Emergency guidance: call 112 now, or 102 for ambulance assistance. No service has been contacted by this app.']
    : [response.care_type ? `Suggested service: ${humanizeSlug(response.care_type)}.` : 'Urgent clinician assessment is recommended.']
  if (response.reasoning) lines.push(response.reasoning)
  if (assessment) {
    lines.push(`Possible symptom groups, not diagnoses: ${assessment.possible_categories.join('; ')}.`)
    if (assessment.risk_factors.length) lines.push(`Reported risk factors: ${assessment.risk_factors.join(' ')}`)
    lines.push(assessment.viral_status)
    lines.push(...assessment.next_steps, ...assessment.supportive_steps)
    if (assessment.missing_information.length) lines.push(`Unknown or unverified: ${assessment.missing_information.join(' ')}`)
    lines.push(assessment.disclaimer)
  }
  return lines.join('\n')
}
