import { useEffect, useState } from 'react'

export type UiLanguage = 'en' | 'hi'
const STORAGE_KEY = 'carecompass.uiLanguage'

const en = {
  greeting: (name: string) => `Hi ${name}, welcome to CareCompass.`,
  howHelp: (name: string) => `${name}, how can we help you today?`,
  chooseExample: 'Choose an example below or tell us what you need in English, Hindi, or Hinglish. You can request care for yourself or someone else.',
  demoBanner: 'Demo only, not a diagnosis, real booking, or emergency dispatch service. For emergencies in India, call 112 or 102.',
  placeholder: 'Describe the symptoms…',
  send: 'Send',
  thinking: 'Thinking…',
  recommended: 'Recommended caregivers',
  recommendedNote: 'Demo matches from a synthetic roster. Only caregivers who serve your area, have the needed skill, and have an open window are shown.',
  book: 'Book (demo)',
  chooseSlot: 'Choose a time (IST)',
  confirm: 'Confirm demo booking',
  booking: 'Booking…',
  cancel: 'Cancel booking',
  close: 'Close',
  confirmed: 'Demo booking confirmed',
  cancelled: 'Demo booking cancelled',
  bookingFor: 'with',
  notContacted: 'No caregiver has been contacted. This is a simulated booking for the demo.',
  uiLanguage: 'Interface',
  newRequest: 'Start a new request',
  matchScore: 'Demo match score',
  emergency: 'Emergency',
  newChat: 'New chat',
}

const hi: typeof en = {
  greeting: (name: string) => `नमस्ते ${name}, CareCompass में आपका स्वागत है।`,
  howHelp: (name: string) => `${name}, आज हम आपकी कैसे मदद करें?`,
  chooseExample: 'नीचे एक उदाहरण चुनें या हिंदी, हिंग्लिश या अंग्रेज़ी में अपनी ज़रूरत बताएं। आप अपने लिए या किसी और के लिए देखभाल मांग सकते हैं।',
  demoBanner: 'केवल डेमो — यह निदान, असली बुकिंग या इमरजेंसी सेवा नहीं है। भारत में इमरजेंसी के लिए 112 या 102 पर कॉल करें।',
  placeholder: 'लक्षण या ज़रूरत लिखें…',
  send: 'भेजें',
  thinking: 'सोच रहे हैं…',
  recommended: 'सुझाए गए केयरगिवर',
  recommendedNote: 'काल्पनिक सूची से डेमो मिलान। केवल वही केयरगिवर दिखाए गए हैं जो आपके क्षेत्र में सेवा देते हैं, ज़रूरी कौशल रखते हैं और जिनका समय खाली है।',
  book: 'बुक करें (डेमो)',
  chooseSlot: 'समय चुनें (IST)',
  confirm: 'डेमो बुकिंग पक्की करें',
  booking: 'बुक हो रहा है…',
  cancel: 'बुकिंग रद्द करें',
  close: 'बंद करें',
  confirmed: 'डेमो बुकिंग पक्की हुई',
  cancelled: 'डेमो बुकिंग रद्द हुई',
  bookingFor: 'के साथ',
  notContacted: 'किसी केयरगिवर से संपर्क नहीं किया गया है। यह डेमो के लिए नकली बुकिंग है।',
  uiLanguage: 'भाषा',
  newRequest: 'नया अनुरोध शुरू करें',
  matchScore: 'डेमो मिलान स्कोर',
  emergency: 'इमरजेंसी',
  newChat: 'नई चैट',
}

export const STRINGS = { en, hi }

const CARE_LABELS: Record<UiLanguage, Record<string, string>> = {
  en: {
    paramedic_home_visit: 'Medic home visit', home_nursing: 'Home nursing', lab_test_home: 'Lab test at home',
    teleconsultation: 'Doctor teleconsultation', emergency_112: 'Emergency (call 112)',
    same_day: 'Same day', scheduled: 'Scheduled', emergency: 'Emergency',
    chest_pain: 'Chest pain', breathlessness: 'Breathlessness', unconsciousness: 'Unconsciousness',
    severe_bleeding: 'Severe bleeding', stroke_symptoms: 'Stroke signs', seizure: 'Seizure',
    high_fever_infant: 'Infant high fever', suicidal_ideation: 'Suicidal ideation', severe_dehydration: 'Severe dehydration',
  },
  hi: {
    paramedic_home_visit: 'घर पर मेडिक विज़िट', home_nursing: 'घर पर नर्सिंग', lab_test_home: 'घर पर लैब टेस्ट',
    teleconsultation: 'डॉक्टर से ऑनलाइन सलाह', emergency_112: 'इमरजेंसी (112 पर कॉल करें)',
    same_day: 'आज ही', scheduled: 'निर्धारित समय पर', emergency: 'इमरजेंसी',
    chest_pain: 'सीने में दर्द', breathlessness: 'सांस लेने में तकलीफ', unconsciousness: 'बेहोशी',
    severe_bleeding: 'गंभीर रक्तस्राव', stroke_symptoms: 'स्ट्रोक के लक्षण', seizure: 'दौरा',
    high_fever_infant: 'शिशु को तेज बुखार', suicidal_ideation: 'आत्मघाती विचार', severe_dehydration: 'गंभीर निर्जलीकरण',
  },
}

export function careLabel(slug: string | null | undefined, language: UiLanguage = 'en') {
  if (!slug) return language === 'hi' ? 'अज्ञात' : 'Unknown'
  return CARE_LABELS[language][slug] ?? slug.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}

export function useUiLanguage() {
  const [language, setLanguage] = useState<UiLanguage>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'hi' ? 'hi' : 'en'
    } catch {
      return 'en'
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language)
    } catch {
      // Preference is optional; private browsing may block storage.
    }
    document.documentElement.lang = language
  }, [language])
  return [language, setLanguage] as const
}
