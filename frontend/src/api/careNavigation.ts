import { apiClient } from './client'
import type { CaregiverProfile, DemoHospital, Location, TaxonomyResponse, TriageRequest, TriageResponse } from './types'

export async function submitTriage(payload: TriageRequest): Promise<TriageResponse> {
  const { data } = await apiClient.post<TriageResponse>('/api/triage', payload)
  return data
}

export async function getCaregivers(): Promise<CaregiverProfile[]> {
  const { data } = await apiClient.get<CaregiverProfile[]>('/api/caregivers')
  return data
}

export async function getTaxonomy(): Promise<TaxonomyResponse> {
  const { data } = await apiClient.get<TaxonomyResponse>('/api/taxonomy')
  return data
}

export async function getDemoHospitals(location: Location | null): Promise<DemoHospital[]> {
  const { data } = await apiClient.get<DemoHospital[]>('/api/hospitals/demo', {
    params: location ? { lat: location.lat, lng: location.lng } : undefined,
  })
  return data
}
