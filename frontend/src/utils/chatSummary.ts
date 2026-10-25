import type { TriageResponse } from '../api/types'
import { humanizeSlug } from './humanize'
import { careLabel, type UiLanguage } from './i18n'

export function translateReasoning(reasoning: string | null | undefined, language: UiLanguage = 'en'): string {
  if (!reasoning) return ''
  if (language !== 'hi') return reasoning
  if (/[\u0900-\u097f]/.test(reasoning)) return reasoning

  const lower = reasoning.toLowerCase()

  if (lower.includes('cut') || lower.includes('wound') || lower.includes('dressing') || lower.includes('patti') || lower.includes('stitches')) {
    return 'मामूली कट या घाव के लिए घर पर ड्रेसिंग व नर्सिंग देखभाल उपयुक्त है।'
  }
  if (lower.includes('injection') || lower.includes('catheter') || lower.includes('bedsore') || lower.includes('iv drip') || lower.includes('drip')) {
    return 'विशेष नर्सिंग प्रक्रिया और देखभाल के लिए घर पर नर्सिंग विज़िट उपयुक्त है; आज ही उपलब्ध।'
  }
  if (lower.includes('diagnostic test') || lower.includes('sample collection') || lower.includes('phlebotomy') || lower.includes('blood test') || lower.includes('sugar') || lower.includes('cbc')) {
    return 'जांच के लिए घर पर सैंपल कलेक्शन का अनुरोध किया गया है; निर्धारित समय पर।'
  }
  if (lower.includes('nursing procedure') || (lower.includes('medic home visit') && lower.includes('nursing'))) {
    return 'विशेष नर्सिंग प्रक्रिया का अनुरोध; घर पर मेडिक विज़िट, आज ही उपलब्ध।'
  }
  if (lower.includes('non-urgent query') || lower.includes('virtual doctor consult') || lower.includes('acidity') || lower.includes('gas') || lower.includes('rash')) {
    return 'गैर-आपातकालीन लक्षण; डॉक्टर से ऑनलाइन परामर्श सबसे उपयुक्त है।'
  }
  if (lower.includes('general complaint') || lower.includes('medic home visit with optional virtual doctor consult') || lower.includes('fever') || lower.includes('bukhar') || lower.includes('cough') || lower.includes('weakness')) {
    return 'लक्षणों की जांच के लिए घर पर मेडिक विज़िट सबसे उपयुक्त है; आज ही।'
  }
  if (lower.includes('ongoing symptom described') || lower.includes('safest non-emergency starting point')) {
    return 'लक्षणों के आधार पर घर पर मेडिक विज़िट सबसे सुरक्षित प्रारंभिक विकल्प है; आज ही।'
  }
  if (lower.includes('unclear after follow-up') || lower.includes('clarify needs safely')) {
    return 'ज़रूरत स्पष्ट करने के लिए डॉक्टर से ऑनलाइन परामर्श सुरक्षित विकल्प है; आज ही।'
  }
  if (lower.includes('red-flag') || lower.includes('potential emergency warning') || lower.includes('emergency')) {
    return 'गंभीर आपातकालीन चेतावनी लक्षण पाए गए हैं। तुरंत 112 या 102 पर कॉल करें; घर पर सामान्य देखभाल के लिए नहीं।'
  }
  if (lower.includes('reported risk factors need prompt clinician assessment')) {
    return 'बताए गए जोखिम कारकों के लिए तुरंत डॉक्टर की सलाह आवश्यक है; आज ही।'
  }

  // Dynamic fallback for arbitrary English strings:
  let translated = reasoning
    .replace(/Minor cut requires wound care\/dressing at home, not life-threatening, so schedule a home nursing visit\.?/gi, 'मामूली कट के लिए घर पर ड्रेसिंग/नर्सिंग देखभाल उपयुक्त है।')
    .replace(/Minor cut requires wound care\/dressing at home/gi, 'मामूली कट के लिए घर पर ड्रेसिंग की आवश्यकता है')
    .replace(/not life-threatening/gi, 'आपातकालीन नहीं है')
    .replace(/so schedule a home nursing visit/gi, 'इसलिए घर पर नर्सिंग सेवा उपयुक्त है')
    .replace(/wound care\/dressing/gi, 'घाव की ड्रेसिंग')
    .replace(/dressing at home/gi, 'घर पर ड्रेसिंग')
    .replace(/home nursing visit/gi, 'घर पर नर्सिंग सेवा')
    .replace(/home visit/gi, 'घर पर विज़िट')
    .replace(/urgency assessed as same_day/gi, 'प्राथमिकता: आज ही')
    .replace(/urgency assessed as scheduled/gi, 'प्राथमिकता: निर्धारित समय पर')
    .replace(/urgency assessed as emergency/gi, 'प्राथमिकता: आपातकालीन')
    .replace(/assessed as same_day/gi, 'प्राथमिकता: आज ही')
    .replace(/assessed as scheduled/gi, 'प्राथमिकता: निर्धारित समय पर')
    .replace(/assessed as emergency/gi, 'प्राथमिकता: आपातकालीन')

  if (!/[\u0900-\u097f]/.test(translated)) {
    return 'बताए गए लक्षणों के आधार पर घर पर देखभाल सेवा सबसे उपयुक्त और सुरक्षित विकल्प है।'
  }
  return translated
}

export function describeResponse(response: TriageResponse, language: UiLanguage = 'en'): string {
  if (response.follow_up_question) return response.follow_up_question
  const assessment = response.assessment
  const emergency = response.care_type === 'emergency_112' || response.urgency === 'emergency' ||
    response.red_flags.length > 0 || assessment?.level === 'emergency'

  const detected = (response.detected_language || '').toLowerCase()
  const isHindi = language === 'hi' || detected === 'hindi' || detected === 'hi' || detected === 'hinglish'

  if (isHindi) {
    const lines: string[] = []
    if (emergency) {
      lines.push('आपातकालीन निर्देश: तुरंत 112 पर कॉल करें, या एम्बुलेंस सहायता के लिए 102 पर संपर्क करें। इस ऐप द्वारा किसी सेवा से संपर्क नहीं किया गया है।')
    } else {
      lines.push(
        response.care_type
          ? `सुझाई गई सेवा: ${careLabel(response.care_type, 'hi')} (${careLabel(response.urgency, 'hi')})।`
          : 'तुरंत डॉक्टर से परामर्श लेने की सलाह दी जाती है।'
      )
    }

    if (response.reasoning) {
      lines.push(translateReasoning(response.reasoning, 'hi'))
    }

    if (assessment) {
      if (assessment.possible_categories && assessment.possible_categories.length) {
        lines.push(`संभावित लक्षण समूह (निदान नहीं): ${assessment.possible_categories.join('; ')}।`)
      }
      if (assessment.risk_factors && assessment.risk_factors.length) {
        lines.push(`रिपोर्ट किए गए जोखिम कारक: ${assessment.risk_factors.join(' ')}।`)
      }
      if (assessment.viral_status) {
        lines.push(
          assessment.viral_status.replace(/Cannot establish viral illness/gi, 'वायरल बीमारी की पुष्टि नहीं की जा सकती')
        )
      }
      if (assessment.next_steps && assessment.next_steps.length) {
        lines.push(...assessment.next_steps)
      }
      if (assessment.disclaimer) {
        lines.push('यह केवल सेवा मार्गदर्शन के लिए है, चिकित्सा निदान नहीं है। आपात स्थिति में तुरंत 112 पर कॉल करें।')
      }
    }
    return lines.join('\n')
  }

  const lines = emergency
    ? ['Emergency guidance: call 112 now, or 102 for ambulance assistance. No service has been contacted by this app.']
    : [response.care_type ? `Suggested service: ${humanizeSlug(response.care_type)}.` : 'Urgent clinician assessment is recommended.']
  if (response.reasoning) lines.push(response.reasoning)
  if (assessment) {
    lines.push(`Possible symptom groups, not diagnoses: ${assessment.possible_categories.join('; ')}.`)
    if (assessment.risk_factors.length) lines.push(`Reported risk factors: ${assessment.risk_factors.join(' ')}`)
    lines.push(assessment.viral_status)
    lines.push(...assessment.next_steps, ...assessment.supportive_steps)
    if (assessment.missing_information.length) lines.push(`Unknown or unverified: ${assessment.missing_information.join(' ')}`)
    lines.push(assessment.disclaimer)
  }
  return lines.join('\n')
}
