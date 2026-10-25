import { useState } from 'react'
import type { SafetyAssessment } from '../api/types'
import type { UiLanguage } from '../utils/i18n'
import { assessmentLabels, localizeAssessmentText } from '../utils/localizeNames'

export function AssessmentCard({ assessment, language = 'en' }: { assessment: SafetyAssessment; language?: UiLanguage }) {
  const isEmergency = assessment.level === 'emergency'
  const [isOpen, setIsOpen] = useState(isEmergency)
  const labels = assessmentLabels(language)
  const tr = (text: string) => localizeAssessmentText(text, language)

  const groups = [
    { title: labels.categories, items: assessment.possible_categories },
    { title: labels.risks, items: assessment.risk_factors },
    { title: labels.next, items: assessment.next_steps },
    { title: labels.support, items: assessment.supportive_steps },
    { title: labels.missing, items: assessment.missing_information },
  ]

  return (
    <section
      className={`rounded-xl border transition-all ${
        isEmergency ? 'border-red-200 bg-red-50 p-4' : 'border-amber-200/80 bg-amber-50/60 p-3.5'
      }`}
      aria-label={labels.aria}
    >
      <div
        className="flex items-center justify-between cursor-pointer select-none gap-2"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base shrink-0">{isEmergency ? '🚨' : '🛡️'}</span>
          <div className="min-w-0">
            <h2 className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
              {labels.heading}
              <span className="ml-1 text-[11px] font-normal text-gray-500">{labels.audit}</span>
            </h2>
            {!isOpen && (
              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {tr(assessment.summary)}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          aria-expanded={isOpen}
          onClick={(e) => {
            e.stopPropagation()
            setIsOpen((prev) => !prev)
          }}
          className="shrink-0 text-[11px] font-medium text-amber-900 bg-amber-100/80 hover:bg-amber-200 border border-amber-300/80 rounded-md px-2.5 py-1 transition"
        >
          {isOpen ? labels.collapse : labels.expand}
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-amber-200/70">
          <p className="text-xs sm:text-sm font-medium text-gray-800">{tr(assessment.summary)}</p>
          {assessment.viral_status && (
            <p className="mt-1 text-xs text-gray-600">{tr(assessment.viral_status)}</p>
          )}
          {groups
            .filter((group) => group.items.length)
            .map((group) => (
              <div key={group.title} className="mt-3">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-700">
                  {group.title}
                </h3>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-600">
                  {group.items.map((item) => (
                    <li key={item}>{tr(item)}</li>
                  ))}
                </ul>
              </div>
            ))}
          <p className="mt-3 border-t border-current/10 pt-2 text-[10px] text-gray-500">
            {tr(assessment.disclaimer)}
          </p>
        </div>
      )}
    </section>
  )
}
