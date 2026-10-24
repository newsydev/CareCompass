import type { SafetyAssessment } from '../api/types'

export function AssessmentCard({ assessment }: { assessment: SafetyAssessment }) {
  const groups = [
    { title: 'Possible symptom groups, not diagnoses', items: assessment.possible_categories },
    { title: 'Reported history and risk factors', items: assessment.risk_factors },
    { title: 'What to do now', items: assessment.next_steps },
    { title: 'Comfort measures while arranging care', items: assessment.supportive_steps },
    { title: 'Unknown or unverified information', items: assessment.missing_information },
  ]
  return (
    <section className={`rounded-xl border p-5 ${assessment.level === 'emergency' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`} aria-label="Symptom safety guidance">
      <h2 className="text-lg font-semibold text-gray-900">Symptom safety guidance <span className="text-sm font-normal">(demo, not a diagnosis)</span></h2>
      <p className="mt-2 text-sm font-medium text-gray-800">{assessment.summary}</p>
      <p className="mt-2 text-sm text-gray-700">{assessment.viral_status}</p>
      {groups.filter((group) => group.items.length).map((group) => (
        <div key={group.title} className="mt-4">
          <h3 className="text-sm font-semibold text-gray-800">{group.title}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-gray-700">
            {group.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ))}
      <p className="mt-4 border-t border-current/10 pt-3 text-xs font-medium text-gray-700">{assessment.disclaimer}</p>
    </section>
  )
}
