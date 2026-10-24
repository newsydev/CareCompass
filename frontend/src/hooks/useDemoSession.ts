import { createContext, useContext } from 'react'
import type { DemoProfile } from '../utils/demoProfile'
import type { DemoChat } from '../utils/chatHistory'

export interface DemoSession {
  profile: DemoProfile | null
  activeChatId: string
  error: string | null
  loading: boolean
  busy: boolean
  saving: boolean
  chats: DemoChat[]
  login: (email: string, password: string, name?: string) => Promise<boolean>
  logout: () => Promise<void>
  updateProfile: (profile: DemoProfile) => Promise<boolean>
  saveChat: (chat: Omit<DemoChat, 'title' | 'updatedAt'>) => Promise<boolean>
  importLegacy: () => Promise<boolean>
  newChat: () => void
  selectChat: (id: string) => void
}

export const DemoSessionContext = createContext<DemoSession | null>(null)

export function useDemoSession() {
  const session = useContext(DemoSessionContext)
  if (!session) throw new Error('DemoSessionProvider is required.')
  return session
}
