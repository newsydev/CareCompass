// Mirrors backend/app/schemas.py exactly. Do not add fields the backend doesn't return.

export interface Location {
  lat: number
  lng: number
}

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface TriageRequest {
  user_input: string
  language?: string
  location?: Location | null
  conversation_history?: ConversationTurn[]
}

export interface CaregiverMatch {
  caregiver_id: string
  score: number
  reason: string
}

export interface TriageResponse {
  follow_up_question: string | null
  care_type: string | null
  urgency: string | null
  red_flags: string[]
  reasoning: string | null
  matched_caregivers: CaregiverMatch[]
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
