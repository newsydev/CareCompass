import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LanguageSheet } from '../components/consult/LanguageSheet'
import { ModeCard } from '../components/consult/ModeCard'
import { TabHeader } from '../components/TabHeader'
import { formatConsultDate, isChatActive } from '../components/consult/format'
import { consultStrings as t } from '../components/consult/strings'
import { useDemoSession } from '../hooks/useDemoSession'
import { chatLanguage, consultPath } from '../utils/consultLang'
import type { UiLanguage } from '../utils/i18n'

const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: 'h-7 w-7' } as const
const ChatIcon = () => <svg {...svg}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z" /></svg>
const PhoneIcon = () => <svg {...svg}><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" /></svg>
const VideoIcon = () => <svg {...svg}><path d="m22 8-6 4 6 4z" /><rect x="2" y="6" width="14" height="12" rx="2" /></svg>

export function ConsultPage() {
  const { chats, newChat, selectChat } = useDemoSession()
  const navigate = useNavigate()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? chats : chats.slice(0, 3)

  function startChat(language: UiLanguage) {
    setSheetOpen(false)
    newChat()
    navigate(consultPath(language, 'chat'))
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-gray-50">
      <TabHeader title={t.title} subtitle={t.subtitle} />

      <div className="mx-auto max-w-2xl px-4 pb-28 pt-6">
        <h2 className="text-lg font-bold text-gray-900">{t.chooseMode}</h2>
        <div data-tour="consult-modes" className="mt-3 flex flex-col gap-3">
          <ModeCard icon={<ChatIcon />} title={t.chatTitle} desc={t.chatDesc} onClick={() => setSheetOpen(true)} />
          <ModeCard icon={<PhoneIcon />} title={t.callTitle} desc={t.callDesc} badge={t.beta} soon soonLabel={t.comingSoon} />
          <ModeCard icon={<VideoIcon />} title={t.videoTitle} desc={t.videoDesc} soon soonLabel={t.comingSoon} />
        </div>

        <section data-tour="recent" className="mt-8" aria-labelledby="recent-title">
          <div className="flex items-center justify-between">
            <h2 id="recent-title" className="text-lg font-bold text-gray-900">{t.recent}</h2>
            {chats.length > 3 && (
              <button
                type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}
                className="min-h-11 rounded-lg px-2 text-sm font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-brand-600"
              >
                {showAll ? t.showLess : t.seeAll}
              </button>
            )}
          </div>
          {chats.length === 0 ? (
            <div className="mt-3 rounded-3xl border border-gray-100 bg-white p-6 text-center shadow-sm">
              <p className="font-bold text-gray-900">{t.emptyTitle}</p>
              <p className="mt-1 text-sm text-gray-600">{t.emptyHint}</p>
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {visible.map((chat) => (
                <li key={chat.id}>
                  <button
                    type="button"
                    onClick={() => { selectChat(chat.id); navigate(consultPath(chatLanguage(chat), 'chat')) }}
                    className="flex w-full items-center gap-3 rounded-3xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                      <svg {...svg} className="h-5 w-5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-gray-900">{chat.title}</span>
                      <span className="block text-sm text-gray-600">{formatConsultDate(chat.updatedAt)}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${isChatActive(chat) ? 'bg-brand-50 text-brand-800' : 'bg-gray-100 text-gray-700'}`}>
                      {isChatActive(chat) ? t.active : t.done}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {sheetOpen && <LanguageSheet onChoose={startChat} onClose={() => setSheetOpen(false)} />}
    </div>
  )
}
