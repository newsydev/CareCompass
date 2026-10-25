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
      <aside className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-50 w-72 max-w-[85%] flex-col border-r border-gray-100 bg-white p-4 shadow-xl`} aria-label="Chat history">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Your chats</h2>
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl px-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-600">Close</button>
        </div>
        <button type="button" onClick={onNew} disabled={disabled} className="mt-4 min-h-12 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:bg-brand-300">+ New chat</button>
        <nav className="mt-4 flex-1 space-y-2 overflow-y-auto" aria-label="Saved conversations">
          {chats.length === 0 && <p className="text-sm text-gray-600">No chats yet.</p>}
          {chats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              disabled={disabled}
              aria-current={chat.id === activeId ? 'page' : undefined}
              onClick={() => onSelect(chat.id)}
              className={`w-full rounded-2xl border p-3 text-left focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50 ${chat.id === activeId ? 'border-brand-200 bg-brand-50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
            >
              <span className="block truncate text-sm font-semibold text-gray-900">{chat.title}</span>
              <span className="mt-1 block text-xs text-gray-600">{new Date(chat.updatedAt).toLocaleString()}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  )
}
