import { humanizeSlug } from '../utils/humanize'
import { careLabel, type UiLanguage } from '../utils/i18n'
import { translateReasoning } from '../utils/chatSummary'

interface EmergencyBannerProps {
  redFlags: string[]
  reasoning: string | null
  language?: UiLanguage
}

export function EmergencyBanner({ redFlags, reasoning, language = 'en' }: EmergencyBannerProps) {
  const isHindi = language === 'hi'

  return (
    <div className="rounded-xl border-2 border-red-300 bg-red-50 p-6" role="alert">
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden="true">
          🚨
        </span>
        <div>
          <h2 className="text-xl font-bold text-red-700">
            {isHindi
              ? (redFlags.length ? 'संभावित आपातकाल: तुरंत सहायता लें' : 'आपातकालीन सहायता')
              : (redFlags.length ? 'Possible emergency: get help now' : 'Emergency assistance')}
          </h2>
          <p className="mt-1 text-red-700">
            {isHindi
              ? 'कृपया तुरंत सहायता के लिए कॉल करें। केयरगिवर का इंतज़ार न करें।'
              : 'Please call for help immediately. Do not wait for a caregiver match.'}
          </p>
          <p className="mt-2 text-sm font-semibold text-red-700">
            {isHindi
              ? 'इस ऐप द्वारा आपातकालीन सेवाओं या एम्बुलेंस से संपर्क नहीं किया गया है।'
              : 'This app has not contacted emergency services or dispatched an ambulance.'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href="tel:112"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-4 text-lg font-bold text-white transition hover:bg-red-700"
        >
          📞 {isHindi ? 'अभी 112 पर कॉल करें' : 'Call 112 Now'}
        </a>
        <a
          href="tel:102"
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-red-600 px-4 py-4 text-lg font-bold text-red-700 transition hover:bg-red-100"
        >
          🚑 {isHindi ? 'एम्बुलेंस (102) पर कॉल करें' : 'Call Ambulance (102)'}
        </a>
      </div>

      {redFlags.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-semibold text-red-700">
            {isHindi ? 'पहचाने गए खतरे के संकेत:' : 'Detected red flags:'}
          </p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {redFlags.map((flag) => (
              <li
                key={flag}
                className="rounded-full border border-red-300 bg-white px-3 py-1 text-sm text-red-700"
              >
                {careLabel(flag, language) || humanizeSlug(flag)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {reasoning && (
        <p className="mt-4 text-sm text-red-700/90">
          {isHindi ? translateReasoning(reasoning, 'hi') : reasoning}
        </p>
      )}
    </div>
  )
}
