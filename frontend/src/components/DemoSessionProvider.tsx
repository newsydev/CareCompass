import axios from 'axios'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DemoSessionContext } from '../hooks/useDemoSession'
import { accountError, authenticate, endSession, importDemo, loadAccount, putChat, putProfile, type AccountData } from '../api/accounts'
import { getLegacyProfile, type DemoProfile } from '../utils/demoProfile'
import { getDemoChats, type DemoChat } from '../utils/chatHistory'

export function DemoSessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<DemoProfile | null>(null)
  const [chats, setChats] = useState<DemoChat[]>([])
  const chatsRef = useRef<DemoChat[]>([])
  const [activeChatId, setActiveChatId] = useState<string>(() => crypto.randomUUID())
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const generation = useRef(0)
  const pendingWrites = useRef(0)
  const writeQueue = useRef<Promise<void>>(Promise.resolve())

  function install(data: AccountData | null) {
    generation.current += 1
    setProfile(data?.profile ?? null)
    chatsRef.current = data?.chats ?? []
    setChats(chatsRef.current)
    setActiveChatId(crypto.randomUUID())
    setError(null)
  }

  useEffect(() => {
    const controller = new AbortController()
    loadAccount(controller.signal).then((data) => {
      if (!controller.signal.aborted) install(data)
    }).catch((failure: unknown) => {
      if (axios.isCancel(failure)) return
      if (!axios.isAxiosError(failure) || failure.response?.status !== 401) setError(accountError(failure))
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [])

  async function login(email: string, password: string, name?: string) {
    setBusy(true)
    setError(null)
    try {
      install(await authenticate(email, password, name))
      return true
    } catch (failure) {
      setError(accountError(failure))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    if (pendingWrites.current) {
      setError('Please wait for your conversation to finish saving before logging out.')
      return
    }
    setBusy(true)
    try {
      await endSession()
      install(null)
    } catch (failure) {
      setError(`Could not log out: ${accountError(failure)}`)
    } finally {
      setBusy(false)
    }
  }

  async function updateProfile(next: DemoProfile) {
    const owner = generation.current
    setBusy(true)
    try {
      const saved = await putProfile(next)
      if (owner !== generation.current) return false
      setProfile(saved)
      setError(null)
      return true
    } catch (failure) {
      setError(`Could not save your profile: ${accountError(failure)}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  function saveChat(chat: Omit<DemoChat, 'title' | 'updatedAt'>): Promise<boolean> {
    const owner = generation.current
    pendingWrites.current += 1
    setSaving(true)
    const operation = writeQueue.current.then(async () => {
      try {
        if (!profile || owner !== generation.current) throw new Error('The account changed. Please sign in again before saving.')
        const previous = chatsRef.current.find((record) => record.id === chat.id)
        const saved = await putChat({ ...chat, revision: previous?.revision ?? 0 })
        if (owner !== generation.current) return false
        chatsRef.current = [saved, ...chatsRef.current.filter((record) => record.id !== saved.id)]
        setChats(chatsRef.current)
        setError(null)
        return true
      } catch (failure) {
        if (owner === generation.current) setError(`Conversation not saved: ${accountError(failure)}`)
        return false
      } finally {
        pendingWrites.current -= 1
        setSaving(pendingWrites.current > 0)
      }
    })
    writeQueue.current = operation.then(() => undefined)
    return operation
  }

  async function importLegacy() {
    if (!profile || pendingWrites.current) return false
    setBusy(true)
    try {
      const exists = ['name', 'address', 'history', 'age', 'pregnant', 'immunity', 'chats']
        .some((key) => sessionStorage.getItem(`carecompass.demo.${key}:${profile.email}`) !== null)
      if (!exists) throw new Error('No earlier demo data for this email was found in this browser tab.')
      install(await importDemo(getLegacyProfile(profile.email), getDemoChats(profile.email)))
      return true
    } catch (failure) {
      setError(`Could not import browser data: ${accountError(failure)}`)
      return false
    } finally {
      setBusy(false)
    }
  }

  function selectChat(id: string) {
    if (pendingWrites.current) {
      setError('Please wait until the conversation is saved before switching chats.')
      return
    }
    setActiveChatId(id)
  }

  return (
    <DemoSessionContext.Provider value={{
      profile, chats, activeChatId, loading, busy, saving, error,
      login, logout, updateProfile, saveChat, importLegacy, selectChat,
      newChat: () => selectChat(crypto.randomUUID()),
    }}>
      {children}
    </DemoSessionContext.Provider>
  )
}
