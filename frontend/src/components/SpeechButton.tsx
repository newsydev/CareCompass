interface SpeechButtonProps {
  isSpeaking: boolean
  disabled: boolean
  onClick: () => void
  label?: string
  stopLabel?: string
  compact?: boolean
}

export function SpeechButton({ isSpeaking, disabled, onClick, label = 'Read reply aloud', stopLabel = 'Stop reading aloud', compact = false }: SpeechButtonProps) {
  return (
    <button
      type="button"
      data-tour={compact ? 'chat-speaker' : undefined}
      disabled={disabled}
      onClick={onClick}
      aria-label={isSpeaking ? stopLabel : label}
      aria-pressed={isSpeaking}
      className={compact
        ? `inline-flex h-9 w-9 items-center justify-center rounded-full text-brand-700 hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-50 ${isSpeaking ? 'bg-brand-100' : ''}`
        : 'inline-flex items-center gap-1.5 self-start rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50'}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4V5Z" />
        {isSpeaking ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />}
      </svg>
      {!compact && (isSpeaking ? 'Stop audio' : 'Listen')}
    </button>
  )
}
