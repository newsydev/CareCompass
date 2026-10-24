import type { ConversationTurn, Location, PatientContext, TriageResponse } from '../api/types'
import { VITAL_FIELDS, validatePatientContext } from './patientContext'

export interface DemoChat {
  id: string
  title: string
  updatedAt: string
  messages: ConversationTurn[]
  patientContext: PatientContext
  recipient: 'self' | 'other'
  emergency: boolean
  revision?: number
  result?: TriageResponse
  location?: Location
  selectedCaregiverId?: string
}

function isTurn(value: unknown): value is ConversationTurn {
  return typeof value === 'object' && value !== null &&
    'role' in value && (value.role === 'user' || value.role === 'assistant') &&
    'content' in value && typeof value.content === 'string'
}

function isChat(value: unknown): value is DemoChat {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'string' &&
    'title' in value && typeof value.title === 'string' &&
    'updatedAt' in value && typeof value.updatedAt === 'string' && Number.isFinite(Date.parse(value.updatedAt)) &&
    'messages' in value && Array.isArray(value.messages) && value.messages.every(isTurn) &&
    'patientContext' in value && isPatientContext(value.patientContext) && validatePatientContext(value.patientContext) === null &&
    'recipient' in value && (value.recipient === 'self' || value.recipient === 'other') &&
    'emergency' in value && typeof value.emergency === 'boolean'
}

function isPatientContext(value: unknown): value is PatientContext {
  if (typeof value !== 'object' || value === null ||
    !('medical_history' in value) || typeof value.medical_history !== 'string' ||
    !('pregnant' in value) || typeof value.pregnant !== 'boolean' ||
    !('immunocompromised' in value) || typeof value.immunocompromised !== 'boolean' ||
    !('vitals' in value) || typeof value.vitals !== 'object' || value.vitals === null ||
    ('age_years' in value && typeof value.age_years !== 'number')) return false
  const vitals = value.vitals
  return VITAL_FIELDS.every((field) => !(field.key in vitals) || typeof Reflect.get(vitals, field.key) === 'number')
}

export function getDemoChats(email: string): DemoChat[] {
  const raw = sessionStorage.getItem(`carecompass.demo.chats:${email}`)
  if (!raw) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || !value.every(isChat)) {
    throw new Error('Saved chat history has an invalid format. It has not been overwritten.')
  }
  return value.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveDemoChat(email: string, record: Omit<DemoChat, 'title' | 'updatedAt'>) {
  const validation = validatePatientContext(record.patientContext)
  if (validation) throw new Error(`Chat patient context is invalid: ${validation}`)
  const previous = getDemoChats(email).filter((chat) => chat.id !== record.id)
  const chat: DemoChat = {
    ...record,
    title: record.messages.find((turn) => turn.role === 'user')?.content.trim().slice(0, 60) || 'Care conversation',
    updatedAt: new Date().toISOString(),
  }
  const chats = [chat, ...previous]
  sessionStorage.setItem(`carecompass.demo.chats:${email}`, JSON.stringify(chats))
  return chats
}
