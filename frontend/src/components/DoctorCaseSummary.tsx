import { useState } from 'react'
import type { PatientContext, TriageResponse } from '../api/types'
import type { DemoProfile } from '../utils/demoProfile'
import { generateDoctorHandover } from '../utils/clinicalHandover'
import type { UiLanguage } from '../utils/i18n'

interface DoctorCaseSummaryProps {
  response: TriageResponse
  profile: DemoProfile
  patientContext?: PatientContext
  recipient?: 'self' | 'other'
  language?: UiLanguage
}

const LABELS = {
  en: {
    title: 'Doctor AI Case Summary', badge: '3-Line Clinical Handoff', sub: 'Formatted for visiting doctor / medic dispatch',
    copyTitle: 'Copy SBAR handover report to clipboard', copied: 'Copied!', copy: 'Copy for Doctor',
    waTitle: 'Share clinical summary via WhatsApp with doctor or caregiver',
    s1: 'SITUATION (Chief Complaint & Urgency)', s2: 'BACKGROUND (Medical History & Baseline Vitals)', s3: 'ACTION FOR CLINICIAN (On-Arrival Protocols)',
    foot: '*Generated automatically from conversational intake for clinician handoff.',
  },
  hi: {
    title: 'डॉक्टर AI केस सारांश', badge: '3-लाइन क्लिनिकल हैंडऑफ़', sub: 'आने वाले डॉक्टर / मेडिक के लिए तैयार',
    copyTitle: 'SBAR हैंडओवर रिपोर्ट कॉपी करें', copied: 'कॉपी हो गया!', copy: 'डॉक्टर के लिए कॉपी करें',
    waTitle: 'डॉक्टर या केयरगिवर को WhatsApp पर क्लिनिकल सारांश भेजें',
    s1: 'स्थिति (मुख्य शिकायत और प्राथमिकता)', s2: 'पृष्ठभूमि (चिकित्सा इतिहास और बेसलाइन वाइटल्स)', s3: 'चिकित्सक के लिए कार्य (पहुँचने पर)',
    foot: '*बातचीत से मिली जानकारी के आधार पर चिकित्सक हैंडऑफ़ के लिए अपने आप बना।',
  },
}

const stripTag = (text: string) => text.replace(/^\[[^\]]+\]\s*/, '')

export function DoctorCaseSummary({
  response,
  profile,
  patientContext,
  recipient = 'self',
  language = 'en',
}: DoctorCaseSummaryProps) {
  const [copied, setCopied] = useState(false)
  const t = LABELS[language]
  const handover = generateDoctorHandover(response, profile, patientContext, recipient, language)

  function handleCopy() {
    navigator.clipboard.writeText(handover.fullText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const encodedWhatsApp = encodeURIComponent(handover.fullText)

  return (
    <div className="rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-600 text-white text-base shadow-xs shrink-0">
            🩺
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">{t.title}</h3>
              <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-bold text-brand-800 uppercase tracking-wider">
                {t.badge}
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              {t.sub}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 transition shadow-xs"
            title={t.copyTitle}
          >
            <span>{copied ? '✓' : '📋'}</span>
            <span>{copied ? t.copied : t.copy}</span>
          </button>
          <a
            href={`https://wa.me/?text=${encodedWhatsApp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-semibold shadow-xs transition"
            title={t.waTitle}
          >
            <span>💬</span>
            <span>WhatsApp</span>
          </a>
        </div>
      </div>

      {/* The 3-Line Clinical Handoff Breakdown */}
      <div className="mt-3.5 space-y-2.5 text-xs">
        {/* Line 1: Situation */}
        <div className="rounded-xl bg-white/90 border border-brand-100 p-3 shadow-xs border-l-4 border-l-brand-500">
          <div className="flex items-center gap-1.5 font-bold text-brand-900 mb-1">
            <span className="text-xs">1️⃣</span>
            <span>{t.s1}</span>
          </div>
          <p className="text-gray-700 leading-relaxed pl-5">
            {stripTag(handover.situation)}
          </p>
        </div>

        {/* Line 2: Background */}
        <div className="rounded-xl bg-white/90 border border-amber-100 p-3 shadow-xs border-l-4 border-l-amber-500">
          <div className="flex items-center gap-1.5 font-bold text-amber-900 mb-1">
            <span className="text-xs">2️⃣</span>
            <span>{t.s2}</span>
          </div>
          <p className="text-gray-700 leading-relaxed pl-5">
            {stripTag(handover.background)}
          </p>
        </div>

        {/* Line 3: Action & Recommendation */}
        <div className="rounded-xl bg-white/90 border border-emerald-100 p-3 shadow-xs border-l-4 border-l-emerald-600">
          <div className="flex items-center gap-1.5 font-bold text-emerald-900 mb-1">
            <span className="text-xs">3️⃣</span>
            <span>{t.s3}</span>
          </div>
          <p className="text-gray-700 leading-relaxed pl-5">
            {stripTag(handover.action)}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] text-gray-500 italic text-right">
        {t.foot}
      </p>
    </div>
  )
}
