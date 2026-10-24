import type { PatientContext, TriageResponse } from '../api/types'
import type { DemoProfile } from './demoProfile'
import { careLabel } from './i18n'

export interface ClinicalHandover {
  situation: string
  background: string
  action: string
  fullText: string
}

export function generateDoctorHandover(
  response: TriageResponse,
  profile: DemoProfile,
  context?: PatientContext,
  recipient: 'self' | 'other' = 'self'
): ClinicalHandover {
  const patientAge = context?.age_years ?? profile.ageYears
  const ageStr = patientAge ? `${patientAge}y` : 'Adult (age unstated)'
  const patientDesc = recipient === 'other' ? `Patient (${ageStr}, family-assisted)` : `${profile.name} (${ageStr})`
  const careTypeLabel = response.care_type ? careLabel(response.care_type) : 'Clinician Evaluation'
  const urgencyLabel = response.urgency ? response.urgency.replace('_', ' ').toUpperCase() : 'ROUTINE'

  // Line 1: Situation
  const symptomGroup = response.assessment?.possible_categories?.[0] || 'Reported acute symptoms'
  const situation = `[SITUATION] ${patientDesc} requests ${careTypeLabel} (Urgency: ${urgencyLabel}). Chief presentation: ${symptomGroup}.`

  // Line 2: Background & Vitals
  const history = context?.medical_history?.trim() || profile.medicalHistory?.trim() || 'No prior chronic conditions stated'
  const missingVitals = response.assessment?.missing_information?.slice(0, 2).join(', ') || 'Baseline vitals unverified'
  const riskNote = response.assessment?.risk_factors?.[0] ? ` Risk: ${response.assessment.risk_factors[0]}.` : ''
  const background = `[BACKGROUND] History: ${history}.${riskNote} Clinical Vitals: ${missingVitals}.`

  // Line 3: Recommendation / Action for Dispatched Caregiver
  const actionDetails = response.reasoning || response.assessment?.next_steps?.[0] || 'Perform physical examination and vitals measurement.'
  const action = `[ACTION FOR CLINICIAN] ${actionDetails} Verify temperature and oxygen saturation immediately upon arrival; escalate if red flags emerge.`

  const fullText = `CareCompass Clinical Handoff Report:\n1. ${situation}\n2. ${background}\n3. ${action}\n*Demo digital triage summary for visiting clinician.*`

  return {
    situation,
    background,
    action,
    fullText,
  }
}
