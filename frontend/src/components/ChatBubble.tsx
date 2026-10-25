import { SpeechButton } from './SpeechButton'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  onReadAloud?: () => void
  isSpeaking?: boolean
  speechDisabled?: boolean
  readLabel?: string
  stopLabel?: string
}

export function ChatBubble({ role, content, onReadAloud, isSpeaking = false, speechDisabled = false, readLabel, stopLabel }: ChatBubbleProps) {
  const isUser = role === 'user'
  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-2.5 ${
          isUser ? 'rounded-br-sm bg-brand-700 text-white' : 'rounded-bl-sm bg-gray-100 text-gray-900'
        }`}
      >
        <p className="whitespace-pre-line break-words text-[15px] leading-relaxed">{content}</p>
        {!isUser && onReadAloud && (
          <div className="-mb-1 -ml-2 mt-1">
            <SpeechButton compact isSpeaking={isSpeaking} disabled={speechDisabled} onClick={onReadAloud} label={readLabel} stopLabel={stopLabel} />
          </div>
        )}
      </div>
    </div>
  )
}
