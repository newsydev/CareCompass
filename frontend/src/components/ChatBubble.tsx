import { SpeechButton } from './SpeechButton'
import type { UiLanguage } from '../utils/i18n'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  onReadAloud?: () => void
  isSpeaking?: boolean
  speechDisabled?: boolean
  language?: UiLanguage
}

export function ChatBubble({ role, content, onReadAloud, isSpeaking = false, speechDisabled = false, language = 'en' }: ChatBubbleProps) {
  const isUser = role === 'user'
  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      <p
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? 'rounded-br-sm bg-brand-500 text-white'
            : 'rounded-bl-sm bg-gray-100 text-gray-800'
        }`}
      >
        {content}
      </p>
      {!isUser && onReadAloud && (
        <SpeechButton isSpeaking={isSpeaking} disabled={speechDisabled} onClick={onReadAloud} language={language} />
      )}
    </div>
  )
}
