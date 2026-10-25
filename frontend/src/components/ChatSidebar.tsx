import { Link } from 'react-router-dom'
import type { DemoChat } from '../utils/chatHistory'

interface ChatSidebarProps {
  chats: DemoChat[]
  activeId: string
  onSelect: (id: string) => void
  onNew: () => void
  disabled: boolean
  open: boolean
  onClose: () => void
}

export function ChatSidebar({ chats, activeId, onSelect, onNew, disabled, open, onClose }: ChatSidebarProps) {
  return (
    <>
      {open && <button type="button" onClick={onClose} className="fixed inset-0 z-40 bg-black/30" aria-label="Close chat history" />}
      <aside className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-50 w-72 max-w-[85%] flex-col border-r border-gray-200 bg-gray-50 p-4`} aria-label="Chat history">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Your chats</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-sm text-gray-600">Close</button>
        </div>
        <button type="button" onClick={onNew} disabled={disabled} className="mt-4 min-h-11 rounded-lg bg-brand-500 px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50">+ New chat</button>
        <nav className="mt-4 flex-1 space-y-2 overflow-y-auto" aria-label="Saved conversations">
          {chats.length === 0 && <p className="text-sm text-gray-500">Your conversations will appear here after you send a message.</p>}
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              disabled={disabled}
              aria-current={chat.id === activeId ? 'page' : undefined}
              onClick={() => onSelect(chat.id)}
              className={`w-full rounded-lg border p-3 text-left disabled:opacity-50 ${chat.id === activeId ? 'border-brand-200 bg-brand-50' : 'border-transparent hover:bg-white'}`}
            >
              <span className="block truncate text-sm font-medium text-gray-800">{chat.title}</span>
              <span className="mt-1 block text-xs text-gray-500">{new Date(chat.updatedAt).toLocaleString()}</span>
            </button>
          ))}
        </nav>
        <Link to="/profile" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-brand-700">Edit profile</Link>
      </aside>
    </>
  )
}
