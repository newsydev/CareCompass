import { useEffect, useState } from 'react'

export type UiLanguage = 'en' | 'hi'
const STORAGE_KEY = 'carecompass.uiLanguage'

const en = {
  greeting: (name: string) => `Hi ${name}, welcome to CareCompass.`,
  howHelp: (name: string) => `${name}, how can we help you today?`,
  demoBanner: 'AI guidance, not a diagnosis. In an emergency call 112 or 102.',
  retrySave: 'Retry saving conversation',
  saveFailed: 'This conversation could not be saved to the database. It remains visible here, but leaving this chat may lose these changes. Retry saving before leaving.',
  otherPatientNew: 'This message mentions another patient. Start a new chat so your medical profile is not applied to someone else.',
  otherPatientSelect: 'This message mentions another patient. Select "Someone else" above and enter their details instead of using your profile.',
  conversationLabel: 'Care conversation',
  yourDetails: 'Your details',
  careAddress: 'Care address',
  addressPlaceholder: 'House number, street, city and postal code',
  saveAddress: 'Save address',
  findingLocation: 'Finding your location...',
  useLocation: 'Use my current location',
  locationShared: (lat: string, lng: string) => `Location shared: ${lat}, ${lng}`,
  openNewTab: 'Open in a new tab',
  voiceLanguageLabel: 'Voice language',
  voiceLangEnglish: 'English / Hinglish',
  voiceLangHindi: 'Hindi',
  requestFailed: (detail: string) => `CareCompass could not complete this request. Your message is saved; review the details and try Send again. ${detail}`,
  noSavedReply: 'The last request has no saved reply. Review the message below and send it again to retry.',
  careRequestLabel: 'Your care request',
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
  followUpContinue: 'Continue',
  followUpSending: 'Sending…',
  followUpOther: 'Anything else? (optional)',
  followUpOtherPlaceholder: 'Add details in your own words',
  followUpRequired: 'Required',
  followUpNeedAnswer: 'Choose an answer to continue.',
  followUpError: 'Your answers are kept. Check your connection and press Continue to try again.',
  followUpLabel: 'A few quick questions',
  followUpMore: 'More choices',
  followUpFewer: 'Fewer choices',
  followUpOtherRow: 'Other / type your own',
  chatTitle: 'AI Powered Doctor',
  chatStatus: 'Online · Available 24/7',
  chatMenu: 'AI Chat',
  chatMenuLabel: 'Chat options',
  chatBack: 'Back to Consult',
  menuHistory: 'Chat history',
  menuDetails: 'Patient & address details',
  menuReadAloud: 'Read replies aloud',
  quickRepliesLabel: 'Choose how to start',
  listening: 'Listening…',
  listeningHint: 'Speak now, then tap the mic again to review your message.',
  micStart: 'Start microphone',
  micStop: 'Stop microphone',
  readAloud: 'Read this message aloud',
  stopAloud: 'Stop reading aloud',
  stopAudio: 'Stop audio',
  assistantGreeting: (name: string) => `Hi ${name}! I'm CareCompass. Tell me what's troubling you. I'll ask a few questions and guide you to the right care.`,
}

const hi: typeof en = {
  greeting: (name: string) => `नमस्ते ${name}, CareCompass में आपका स्वागत है।`,
  howHelp: (name: string) => `${name}, आज हम आपकी कैसे मदद करें?`,
  demoBanner: 'AI मार्गदर्शन है, निदान नहीं। इमरजेंसी में 112 या 102 पर कॉल करें।',
  retrySave: 'बातचीत दोबारा सेव करें',
  saveFailed: 'यह बातचीत डेटाबेस में सेव नहीं हो सकी। यह यहाँ दिख रही है, पर इस चैट से बाहर जाने पर बदलाव खो सकते हैं। बाहर जाने से पहले दोबारा सेव करें।',
  otherPatientNew: 'इस संदेश में किसी दूसरे मरीज़ का ज़िक्र है। नई चैट शुरू करें ताकि आपकी मेडिकल प्रोफ़ाइल किसी और पर लागू न हो।',
  otherPatientSelect: 'इस संदेश में किसी दूसरे मरीज़ का ज़िक्र है। ऊपर "किसी और के लिए" चुनें और अपनी प्रोफ़ाइल की जगह उनकी जानकारी भरें।',
  conversationLabel: 'देखभाल की बातचीत',
  yourDetails: 'आपकी जानकारी',
  careAddress: 'देखभाल का पता',
  addressPlaceholder: 'मकान नंबर, गली, शहर और पिन कोड',
  saveAddress: 'पता सेव करें',
  findingLocation: 'आपकी लोकेशन खोज रहे हैं...',
  useLocation: 'मेरी मौजूदा लोकेशन इस्तेमाल करें',
  locationShared: (lat: string, lng: string) => `लोकेशन साझा की गई: ${lat}, ${lng}`,
  openNewTab: 'नए टैब में खोलें',
  voiceLanguageLabel: 'बोलने की भाषा',
  voiceLangEnglish: 'अंग्रेज़ी / हिंग्लिश',
  voiceLangHindi: 'हिन्दी',
  requestFailed: (detail: string) => `CareCompass यह अनुरोध पूरा नहीं कर सका। आपका संदेश सेव है; जानकारी जाँचकर दोबारा भेजें। ${detail}`,
  noSavedReply: 'पिछले अनुरोध का कोई सेव किया हुआ जवाब नहीं है। नीचे का संदेश जाँचकर दोबारा भेजें।',
  careRequestLabel: 'आपका देखभाल अनुरोध',
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
  followUpContinue: 'आगे बढ़ें',
  followUpSending: 'भेज रहे हैं…',
  followUpOther: 'कुछ और? (वैकल्पिक)',
  followUpOtherPlaceholder: 'अपने शब्दों में लिखें',
  followUpRequired: 'ज़रूरी',
  followUpNeedAnswer: 'आगे बढ़ने के लिए एक जवाब चुनें।',
  followUpError: 'आपके जवाब सुरक्षित हैं। कनेक्शन जांचें और दोबारा “आगे बढ़ें” दबाएं।',
  followUpLabel: 'कुछ छोटे सवाल',
  followUpMore: 'और विकल्प',
  followUpFewer: 'कम विकल्प',
  followUpOtherRow: 'अन्य / अपने शब्दों में लिखें',
  chatTitle: 'AI पावर्ड डॉक्टर',
  chatStatus: 'ऑनलाइन · 24/7 उपलब्ध',
  chatMenu: 'AI चैट',
  chatMenuLabel: 'चैट विकल्प',
  chatBack: 'कंसल्ट पर वापस जाएँ',
  menuHistory: 'चैट इतिहास',
  menuDetails: 'मरीज़ और पते की जानकारी',
  menuReadAloud: 'जवाब बोलकर सुनाएँ',
  quickRepliesLabel: 'शुरू करने का तरीका चुनें',
  listening: 'सुन रहे हैं…',
  listeningHint: 'अब बोलें, फिर अपना संदेश देखने के लिए माइक दोबारा दबाएँ।',
  micStart: 'माइक शुरू करें',
  micStop: 'माइक बंद करें',
  readAloud: 'यह संदेश बोलकर सुनाएँ',
  stopAloud: 'बोलना बंद करें',
  stopAudio: 'आवाज़ बंद करें',
  assistantGreeting: (name: string) => `नमस्ते ${name}! मैं CareCompass हूँ। अपनी तकलीफ़ मुझे बताइए। मैं कुछ ज़रूरी सवाल पूछूँगी और आपको सही देखभाल तक पहुँचाऊँगी।`,
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
