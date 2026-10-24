import { useState } from 'react'
import { CaregiverCard } from '../components/CaregiverCard'
import { ChatBubble } from '../components/ChatBubble'
import { EmergencyBanner } from '../components/EmergencyBanner'
import { RecommendationCard } from '../components/RecommendationCard'
import { useCaregivers } from '../hooks/useCaregivers'
import { useGeolocation } from '../hooks/useGeolocation'
import { useTriage } from '../hooks/useTriage'
import type { ConversationTurn, TriageResponse } from '../api/types'

export function TriagePage() {
  const [history, setHistory] = useState<ConversationTurn[]>([])
  const [input, setInput] = useState('')
  const [result, setResult] = useState<TriageResponse | null>(null)
  const [bookedCaregiverId, setBookedCaregiverId] = useState<string | null>(null)

  const { location } = useGeolocation()
  const triage = useTriage()
  const { data: caregivers } = useCaregivers()

  const isDecided = result !== null && result.follow_up_question === null
  const isEmergency = isDecided && result!.red_flags.length > 0

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || triage.isPending) return

    triage.mutate(
      {
        user_input: text,
        language: 'auto',
        location,
        conversation_history: history,
      },
      {
        onSuccess: (response) => {
          setHistory((prev) => [
            ...prev,
            { role: 'user', content: text },
            ...(response.follow_up_question
              ? [{ role: 'assistant' as const, content: response.follow_up_question }]
              : []),
          ])
          setResult(response)
          setInput('')
        },
      },
    )
  }

  function startOver() {
    setHistory([])
    setResult(null)
    setInput('')
    setBookedCaregiverId(null)
    triage.reset()
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-6 sm:py-10">
      <header className="mb-6 flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
          CC
        </span>
        <h1 className="text-lg font-semibold text-gray-900">CareCompass</h1>
      </header>

      {history.length === 0 && !result && (
        <p className="mb-4 text-sm text-gray-500">
          Describe what's wrong, in English, Hindi, or Hinglish — e.g. "Papa ko do din se bukhar
          hai aur khansi bhi."
        </p>
      )}

      <div className="flex flex-1 flex-col gap-3">
        {history.map((turn, i) => (
          <ChatBubble key={i} role={turn.role} content={turn.content} />
        ))}

        {triage.isPending && (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
              Thinking…
            </p>
          </div>
        )}

        {triage.isError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Couldn't reach CareCompass right now. Please check your connection and try again.
          </div>
        )}

        {isDecided && isEmergency && (
          <EmergencyBanner redFlags={result!.red_flags} reasoning={result!.reasoning} />
        )}

        {isDecided && !isEmergency && (
          <>
            <RecommendationCard
              careType={result!.care_type}
              urgency={result!.urgency}
              reasoning={result!.reasoning}
            />

            {result!.matched_caregivers.length > 0 && (
              <div className="mt-2 flex flex-col gap-3">
                <h2 className="text-sm font-semibold text-gray-500">Recommended caregivers</h2>
                {result!.matched_caregivers.map((match) => (
                  <CaregiverCard
                    key={match.caregiver_id}
                    caregiverId={match.caregiver_id}
                    matchScore={match.score}
                    matchReason={match.reason}
                    profile={caregivers?.find((c) => c.caregiver_id === match.caregiver_id)}
                    onBook={() => setBookedCaregiverId(match.caregiver_id)}
                  />
                ))}
              </div>
            )}

            {bookedCaregiverId && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                ✅ Booking confirmed with{' '}
                {caregivers?.find((c) => c.caregiver_id === bookedCaregiverId)?.name ??
                  bookedCaregiverId}
                . They'll be notified shortly.
              </div>
            )}
          </>
        )}
      </div>

      {isDecided ? (
        <button
          type="button"
          onClick={startOver}
          className="mt-6 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
        >
          Start a new request
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            rows={1}
            placeholder="Describe the symptoms…"
            className="min-h-[52px] flex-1 resize-none rounded-lg border border-gray-200 px-3.5 py-3 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          />
          <button
            type="submit"
            disabled={!input.trim() || triage.isPending}
            className="h-[52px] shrink-0 rounded-lg bg-brand-500 px-5 text-sm font-semibold text-white transition hover:bg-brand-600 active:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </form>
      )}
    </div>
  )
}
