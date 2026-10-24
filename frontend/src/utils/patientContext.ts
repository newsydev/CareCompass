import type { PatientContext, Vitals } from '../api/types'
import type { DemoProfile } from './demoProfile'

export const VITAL_FIELDS: { key: keyof Vitals; label: string; min: number; max: number }[] = [
  { key: 'temperature_c', label: 'Temperature (C)', min: 30, max: 45 },
  { key: 'oxygen_percent', label: 'Oxygen saturation (%)', min: 1, max: 100 },
  { key: 'heart_rate', label: 'Pulse (beats/min)', min: 1, max: 300 },
  { key: 'systolic_bp', label: 'Systolic BP (mmHg)', min: 1, max: 300 },
  { key: 'diastolic_bp', label: 'Diastolic BP (mmHg)', min: 1, max: 200 },
  { key: 'respiratory_rate', label: 'Breathing rate (breaths/min)', min: 1, max: 100 },
]

export function patientContextFromProfile(profile?: DemoProfile): PatientContext {
  return {
    age_years: profile?.ageYears,
    medical_history: profile?.medicalHistory ?? '',
    pregnant: profile?.pregnant ?? false,
    immunocompromised: profile?.immunocompromised ?? false,
    vitals: {},
  }
}

export function validatePatientContext(context: PatientContext): string | null {
  if (context.age_years !== undefined && (!Number.isFinite(context.age_years) || context.age_years < 0 || context.age_years > 120)) {
    return 'Enter a valid patient age between 0 and 120 years, or leave it blank if unknown.'
  }
  if (context.medical_history.length > 4000) return 'Patient history must be 4,000 characters or less.'
  for (const field of VITAL_FIELDS) {
    const value = context.vitals[field.key]
    if (value !== undefined && (!Number.isFinite(value) || value < field.min || value > field.max)) {
      return `${field.label} must be between ${field.min} and ${field.max}. Verify the reading and units; do not delay emergency care to remeasure.`
    }
  }
  const { systolic_bp, diastolic_bp } = context.vitals
  if (systolic_bp !== undefined && diastolic_bp !== undefined && systolic_bp <= diastolic_bp) {
    return 'Systolic blood pressure must be greater than diastolic pressure. Verify both readings.'
  }
  return null
}
