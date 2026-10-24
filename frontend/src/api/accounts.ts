import axios from 'axios'
import { apiClient } from './client'
import type { DemoProfile } from '../utils/demoProfile'
import type { DemoChat } from '../utils/chatHistory'

export interface AccountData {
  profile: DemoProfile
  chats: DemoChat[]
}

export function accountError(failure: unknown) {
  if (axios.isAxiosError<{ detail?: unknown }>(failure)) {
    const detail = failure.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((item: unknown) =>
        typeof item === 'object' && item !== null && 'msg' in item && typeof item.msg === 'string'
          ? item.msg : 'Invalid account data.',
      ).join(' ')
    }
    if (!failure.response) return 'Cannot reach the server. Your changes have not been confirmed; check the connection and retry.'
  }
  return failure instanceof Error ? failure.message : 'The account request failed.'
}

export async function loadAccount(signal?: AbortSignal) {
  return (await apiClient.get<AccountData>('/api/account', { signal })).data
}

export async function authenticate(email: string, password: string, name?: string) {
  return (await apiClient.post<AccountData>(name === undefined ? '/api/auth/login' : '/api/auth/register', {
    email, password, ...(name === undefined ? {} : { name }),
  })).data
}

export async function endSession() {
  await apiClient.post('/api/auth/logout')
}

export async function putProfile(profile: DemoProfile) {
  return (await apiClient.put<DemoProfile>('/api/account/profile', profile)).data
}

export async function putChat(chat: Omit<DemoChat, 'title' | 'updatedAt'>) {
  return (await apiClient.put<DemoChat>(`/api/account/chats/${encodeURIComponent(chat.id)}`, chat)).data
}

export async function importDemo(profile: DemoProfile, chats: DemoChat[]) {
  return (await apiClient.post<AccountData>('/api/account/import-demo', { profile, chats })).data
}
