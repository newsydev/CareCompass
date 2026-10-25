// Mirrors backend/app/schemas.py exactly. Do not add fields the backend doesn't return.

export interface Location {
  lat: number
  lng: number
}

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
  patientContext?: PatientContext
  location?: Location
  result?: TriageResponse
  follow_up_ids?: string[] // assistant turn: ids of the follow-up questions it asked
  answers?: FollowUpAnswers // user turn: answers given to those questions
}

export type FollowUpAnswerValue = string | string[]
export type FollowUpAnswers = Record<string, FollowUpAnswerValue>

export interface FollowUpOption {
  value: string
  label: string
  text?: string | null // canonical clinical phrase used in the composed answer
  age_years?: number | null
}

export interface FollowUpQuestion {
  question_id: string
  question_text: string
  summary_label: string
  input_type: 'single_choice' | 'multi_choice' | 'text'
  options: FollowUpOption[]
  required: boolean
  allow_custom_input: boolean
}

export type TriageAction = 'answer' | 'ask_followup' | 'urgent_guidance'

export interface TriageRequest {
  user_input: string
  language?: string
  location?: Location | null
  conversation_history?: ConversationTurn[]
  patient_context?: PatientContext
  answers?: FollowUpAnswers
}

export interface Vitals {
  temperature_c?: number
  oxygen_percent?: number
  heart_rate?: number
  systolic_bp?: number
  diastolic_bp?: number
  respiratory_rate?: number
}

export interface PatientContext {
  age_years?: number
  medical_history: string
  pregnant: boolean
  immunocompromised: boolean
  vitals: Vitals
}

export interface SafetyAssessment {
  level: 'emergency' | 'clinician_review' | 'self_care_support'
  summary: string
  possible_categories: string[]
  risk_factors: string[]
  critical_signs: string[]
  next_steps: string[]
  supportive_steps: string[]
  missing_information: string[]
  requires_prompt_review: boolean
  blocks_home_booking?: boolean
  viral_status: string
  disclaimer: string
}

export interface DemoHospital {
  hospital_id: string
  name: string
  area: string
  distance_km: number | null
  availability: 'not_verified'
  is_demo: true
}

export interface CaregiverMatch {
  caregiver_id: string
  score: number
  reason: string
  next_available?: string | null
}

export interface Booking {
  booking_id: string
  chat_id: string | null
  caregiver_id: string
  caregiver_name: string | null
  care_type: string
  urgency: string | null
  slot_start: string
  status: 'confirmed_demo' | 'cancelled'
  created_at: string
  is_demo: true
}

export interface Helpline {
  name: string
  number: string
  description?: string | null
}

// Optional: set by the backend when a message suggests the patient may be at risk of self-harm.
export interface CrisisInfo {
  kind: string
  helplines?: Helpline[]
  message?: string | null
}

export interface TriageResponse {
  crisis?: CrisisInfo | null
  follow_up_question: string | null
  care_type: string | null
  urgency: string | null
  red_flags: string[]
  reasoning: string | null
  matched_caregivers: CaregiverMatch[]
  matching_note?: string | null
  detected_language?: string | null
  assessment?: SafetyAssessment | null
  action?: TriageAction | null
  intent?: string | null // set when the message was not a symptom report (greeting, health_info, out_of_scope, ...)
  message?: string | null
  questions?: FollowUpQuestion[]
  answered_context?: Record<string, string>
}

// Raw record shape from GET /api/caregivers (backend/app/data/caregivers.csv columns)
export interface CaregiverProfile {
  caregiver_id: string
  name: string
  role: string
  qualification: string
  gender: string
  languages: string // semicolon-separated
  skills: string // semicolon-separated
  base_area: string
  base_lat: number
  base_lng: number
  max_radius_km: number
  tier: string
  rating: number
  experience_years: number
  free_from: string
  free_until: string
  active: boolean
}

export interface CareTypeInfo {
  default_urgency: string
  role: string | null
  description: string
}

export interface TaxonomyResponse {
  red_flag_controlled_vocab: string[]
  red_flag_triggers: Record<string, string[]>
  care_types: Record<string, CareTypeInfo>
}
