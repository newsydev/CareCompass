import type { PatientContext, TriageResponse } from '../api/types'
import type { DemoProfile } from './demoProfile'
import { translateReasoning } from './chatSummary'
import { careLabel, type UiLanguage } from './i18n'
import { localizeAssessmentText } from './localizeNames'

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
  recipient: 'self' | 'other' = 'self',
  language: UiLanguage = 'en',
): ClinicalHandover {
  const hi = language === 'hi'
  const patientAge = context?.age_years ?? profile.ageYears
  const ageStr = patientAge ? `${patientAge}${hi ? ' वर्ष' : 'y'}` : hi ? 'वयस्क (उम्र अज्ञात)' : 'Adult (age unstated)'
  const patientDesc = recipient === 'other'
    ? (hi ? `मरीज़ (${ageStr}, परिवार की सहायता से)` : `Patient (${ageStr}, family-assisted)`)
    : `${profile.name} (${ageStr})`
  const careTypeLabel = response.care_type ? careLabel(response.care_type, language) : hi ? 'डॉक्टर द्वारा जांच' : 'Clinician Evaluation'
  const urgencyLabel = response.urgency
    ? (hi ? careLabel(response.urgency, 'hi') : response.urgency.replace('_', ' ').toUpperCase())
    : hi ? 'सामान्य' : 'ROUTINE'

  // Line 1: Situation
  const symptomGroup = localizeAssessmentText(response.assessment?.possible_categories?.[0] || (hi ? 'बताए गए तीव्र लक्षण' : 'Reported acute symptoms'), language)
  const situation = hi
    ? `[स्थिति] ${patientDesc} ने ${careTypeLabel} का अनुरोध किया है (प्राथमिकता: ${urgencyLabel})। मुख्य समस्या: ${symptomGroup}।`
    : `[SITUATION] ${patientDesc} requests ${careTypeLabel} (Urgency: ${urgencyLabel}). Chief presentation: ${symptomGroup}.`

  // Line 2: Background & Vitals
  const history = context?.medical_history?.trim() || profile.medicalHistory?.trim() || (hi ? 'कोई पुरानी बीमारी नहीं बताई गई' : 'No prior chronic conditions stated')
  const missingVitals = response.assessment?.missing_information?.slice(0, 2).map((item) => localizeAssessmentText(item, language)).join(', ') || (hi ? 'बेसलाइन वाइटल्स सत्यापित नहीं' : 'Baseline vitals unverified')
  const firstRisk = response.assessment?.risk_factors?.[0]
  const riskNote = firstRisk ? (hi ? ` जोखिम: ${localizeAssessmentText(firstRisk, 'hi').replace(/[।.]$/, '')}।` : ` Risk: ${firstRisk}.`) : ''
  const background = hi
    ? `[पृष्ठभूमि] इतिहास: ${history}।${riskNote} वाइटल्स: ${missingVitals}।`
    : `[BACKGROUND] History: ${history}.${riskNote} Clinical Vitals: ${missingVitals}.`

  // Line 3: Recommendation / Action for Dispatched Caregiver
  const firstStep = response.assessment?.next_steps?.[0]
  const actionDetails = hi
    ? (response.reasoning ? translateReasoning(response.reasoning, 'hi') : firstStep ? localizeAssessmentText(firstStep, 'hi') : 'शारीरिक जांच करें और वाइटल्स नापें।')
    : response.reasoning || firstStep || 'Perform physical examination and vitals measurement.'
  const action = hi
    ? `[चिकित्सक के लिए कार्य] ${actionDetails} पहुँचते ही तापमान और ऑक्सीजन सैचुरेशन जांचें; खतरे के संकेत दिखें तो तुरंत आगे रेफ़र करें।`
    : `[ACTION FOR CLINICIAN] ${actionDetails} Verify temperature and oxygen saturation immediately upon arrival; escalate if red flags emerge.`

  const fullText = hi
    ? `CareCompass क्लिनिकल हैंडऑफ़ रिपोर्ट:\n1. ${situation}\n2. ${background}\n3. ${action}\n*आने वाले चिकित्सक के लिए डेमो डिजिटल ट्राइएज सारांश।*`
    : `CareCompass Clinical Handoff Report:\n1. ${situation}\n2. ${background}\n3. ${action}\n*Demo digital triage summary for visiting clinician.*`

  return {
    situation,
    background,
    action,
    fullText,
  }
}
