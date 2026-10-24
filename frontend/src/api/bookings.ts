import { apiClient } from './client'
import type { Booking } from './types'

export interface BookingRequest {
  caregiver_id: string
  care_type: string
  urgency: string | null
  slot_start: string
  chat_id: string
}

export async function createBooking(body: BookingRequest) {
  return (await apiClient.post<Booking>('/api/bookings', body)).data
}

export async function listBookings(signal?: AbortSignal) {
  return (await apiClient.get<Booking[]>('/api/bookings', { signal })).data
}

export async function cancelBooking(bookingId: string) {
  return (await apiClient.post<Booking>(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`)).data
}
