interface ChatLike {
  messages: { role: 'user' | 'assistant' }[]
  result?: { follow_up_question?: unknown } | null
}

/** Active = nothing decided yet: no result, a pending follow-up question, or the last turn is the user's. */
export function isChatActive(chat: ChatLike) {
  if (!chat.result) return true
  if (chat.result.follow_up_question) return true
  return chat.messages.at(-1)?.role === 'user'
}

/** e.g. "24 Oct, 7:30 pm" */
export function formatConsultDate(iso: string, locale = 'en-IN') {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const day = date.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const time = date.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${day}, ${time.replace(/\s?(AM|PM)/i, (_, p: string) => ` ${p.toLowerCase()}`)}`
}
