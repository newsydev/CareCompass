import { useState } from 'react'
import type { PatientContext, TriageResponse } from '../api/types'
import type { DemoProfile } from '../utils/demoProfile'
import { generateDoctorHandover } from '../utils/clinicalHandover'

interface DoctorCaseSummaryProps {
  response: TriageResponse
  profile: DemoProfile
  patientContext?: PatientContext
  recipient?: 'self' | 'other'
}

export function DoctorCaseSummary({
  response,
  profile,
  patientContext,
  recipient = 'self',
}: DoctorCaseSummaryProps) {
  const [copied, setCopied] = useState(false)
  const handover = generateDoctorHandover(response, profile, patientContext, recipient)

  function handleCopy() {
    navigator.clipboard.writeText(handover.fullText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const encodedWhatsApp = encodeURIComponent(handover.fullText)

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-sky-50/50 p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-indigo-100/80 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white text-base shadow-xs shrink-0">
            🩺
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">Doctor AI Case Summary</h3>
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800 uppercase tracking-wider">
                3-Line Clinical Handoff
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Formatted for visiting doctor / medic dispatch
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition shadow-xs"
            title="Copy SBAR handover report to clipboard"
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? 'Copied!' : 'Copy for Doctor'}</span>
          </button>
          <a
            href={`https://wa.me/?text=${encodedWhatsApp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-semibold shadow-xs transition"
            title="Share clinical summary via WhatsApp with doctor or caregiver"
          >
            <span>💬</span>
            <span>WhatsApp</span>
          </a>
        </div>
      </div>

      {/* The 3-Line Clinical Handoff Breakdown */}
      <div className="mt-3.5 space-y-2.5 text-xs">
        {/* Line 1: Situation */}
        <div className="rounded-xl bg-white/90 border border-sky-100 p-3 shadow-xs border-l-4 border-l-sky-500">
          <div className="flex items-center gap-1.5 font-bold text-sky-900 mb-1">
            <span className="text-xs">1️⃣</span>
            <span>SITUATION (Chief Complaint & Urgency)</span>
          </div>
          <p className="text-slate-700 leading-relaxed pl-5">
            {handover.situation.replace('[SITUATION] ', '')}
          </p>
        </div>

        {/* Line 2: Background */}
        <div className="rounded-xl bg-white/90 border border-amber-100 p-3 shadow-xs border-l-4 border-l-amber-500">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
            <span className="text-xs">2️⃣</span>
            <span>BACKGROUND (Medical History & Baseline Vitals)</span>
          </div>
          <p className="text-slate-700 leading-relaxed pl-5">
            {handover.background.replace('[BACKGROUND] ', '')}
          </p>
        </div>

        {/* Line 3: Action & Recommendation */}
        <div className="rounded-xl bg-white/90 border border-emerald-100 p-3 shadow-xs border-l-4 border-l-emerald-600">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
            <span className="text-xs">3️⃣</span>
            <span>ACTION FOR CLINICIAN (On-Arrival Protocols)</span>
          </div>
          <p className="text-slate-700 leading-relaxed pl-5">
            {handover.action.replace('[ACTION FOR CLINICIAN] ', '')}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-gray-500 italic text-right">
        *Generated automatically from conversational intake for clinician handoff.
      </p>
    </div>
  )
}
