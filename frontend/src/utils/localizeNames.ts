// Hindi display text for caregiver rosters and backend-generated English strings.
// No imports on purpose, so tests can load this file on its own. Unknown text is returned unchanged.
export type Lang = 'en' | 'hi'

const FIRST: Record<string, string> = {
  Amit: 'अमित', Anjali: 'अंजलि', Ankit: 'अंकित', Deepak: 'दीपक', Divya: 'दिव्या', Kavita: 'कविता',
  Manoj: 'मनोज', Meena: 'मीना', Mohit: 'मोहित', Naveen: 'नवीन', Neha: 'नेहा', Nisha: 'निशा',
  Pawan: 'पवन', Pooja: 'पूजा', Priya: 'प्रिया', Rahul: 'राहुल', Rekha: 'रेखा', Ritu: 'ऋतु',
  Sandeep: 'संदीप', Shalini: 'शालिनी', Sunil: 'सुनील', Sunita: 'सुनीता', Vikas: 'विकास',
}
const LAST: Record<string, string> = {
  Kumar: 'कुमार', Rawat: 'रावत', Mishra: 'मिश्रा', Sharma: 'शर्मा', Gupta: 'गुप्ता', Verma: 'वर्मा',
  Das: 'दास', Bisht: 'बिष्ट', Saini: 'सैनी', Yadav: 'यादव', Singh: 'सिंह', Chauhan: 'चौहान',
}
const ROLES: Record<string, string> = {
  doctor: 'डॉक्टर', medic: 'मेडिक', nurse: 'नर्स', phlebotomist: 'फ्लेबोटोमिस्ट',
}
const ROLES_WITH_NURSE: Record<string, string> = { ...ROLES, medic: 'नर्स / मेडिक' }
const QUALIFICATIONS: Record<string, string> = {
  MBBS: 'एमबीबीएस', 'B.Sc Nursing': 'बी.एससी नर्सिंग', DMLT: 'डीएमएलटी', 'GNM Nursing': 'जीएनएम नर्सिंग',
}
const AREAS: Record<string, string> = {
  Dwarka: 'द्वारका', 'Faridabad NIT': 'फरीदाबाद एनआईटी', Govindpuri: 'गोविंदपुरी', 'Greater Noida': 'ग्रेटर नोएडा',
  'Gurugram DLF': 'गुरुग्राम डीएलएफ', 'Gurugram Sec 29': 'गुरुग्राम सेक्टर 29', Indirapuram: 'इंदिरापुरम',
  Janakpuri: 'जनकपुरी', Kalkaji: 'कालकाजी', 'Karol Bagh': 'करोल बाग', 'Lajpat Nagar': 'लाजपत नगर',
  'Mayur Vihar': 'मयूर विहार', 'Noida Sec 18': 'नोएडा सेक्टर 18', 'Noida Sec 62': 'नोएडा सेक्टर 62',
  Pitampura: 'पीतमपुरा', Rohini: 'रोहिणी', Saket: 'साकेत', 'Vasant Kunj': 'वसंत कुंज',
}
const LANGUAGES: Record<string, string> = {
  Bengali: 'बंगाली', Bhojpuri: 'भोजपुरी', English: 'अंग्रेज़ी', Haryanvi: 'हरियाणवी', Hindi: 'हिंदी',
  Punjabi: 'पंजाबी', Tamil: 'तमिल',
}
const SKILLS: Record<string, string> = {
  bp_sugar_check: 'बीपी / शुगर जांच', catheter_care: 'कैथेटर देखभाल', elderly_care: 'बुज़ुर्गों की देखभाल',
  home_phlebotomy: 'घर पर ब्लड सैंपल', injection_im: 'इंजेक्शन (मांसपेशी)', injection_iv: 'इंजेक्शन (नस)',
  nebulization: 'नेबुलाइज़ेशन', post_surgical_care: 'ऑपरेशन के बाद देखभाल', prescription: 'प्रिस्क्रिप्शन',
  report_review: 'रिपोर्ट की समीक्षा', sample_collection: 'सैंपल कलेक्शन', teleconsultation: 'ऑनलाइन परामर्श',
  vitals_monitoring: 'वाइटल्स की निगरानी', wound_dressing: 'घाव की ड्रेसिंग',
}
const TIERS: Record<string, string> = { base: 'बेस', standard: 'स्टैंडर्ड', advanced: 'एडवांस्ड', expert: 'एक्सपर्ट' }

export function localName(name: string | null | undefined, language: Lang): string {
  const value = (name ?? '').trim()
  if (language !== 'hi' || !value) return value
  const words = value.split(/\s+/)
  const mapped = words.map((word, index) => (index === words.length - 1 && words.length > 1 ? LAST[word] : FIRST[word]) ?? FIRST[word] ?? LAST[word])
  return mapped.every(Boolean) ? mapped.join(' ') : value
}

export function localRole(role: string | null | undefined, language: Lang, withNurse = false): string | undefined {
  if (!role) return undefined
  if (language !== 'hi') return undefined
  return (withNurse ? ROLES_WITH_NURSE : ROLES)[role]
}

export const localQualification = (value: string | null | undefined, language: Lang) =>
  language === 'hi' && value ? QUALIFICATIONS[value] ?? value : value ?? ''
export const localArea = (value: string | null | undefined, language: Lang) =>
  language === 'hi' && value ? AREAS[value] ?? value : value ?? ''
export const localLanguage = (value: string, language: Lang) => (language === 'hi' ? LANGUAGES[value] ?? value : value)
export const localSkill = (slug: string, language: Lang) => {
  const key = slug.trim().replace(/ /g, '_')
  return language === 'hi' && SKILLS[key] ? SKILLS[key] : null
}

function reasonPart(part: string): string {
  let m = /^(.+)-speaking$/.exec(part)
  if (m) return `${LANGUAGES[m[1]] ?? m[1]}-भाषी`
  if (part === 'virtual consult') return 'ऑनलाइन परामर्श'
  m = /^([\d.]+) km away$/.exec(part)
  if (m) return `${m[1]} किमी दूर`
  if (part === 'distance not verified (location not shared)') return 'दूरी सत्यापित नहीं (स्थान साझा नहीं)'
  m = /^free (\S+?)[–-](\S+)$/.exec(part)
  if (m) return `उपलब्ध समय ${m[1]}–${m[2]}`
  m = /^skilled in (.+)$/.exec(part)
  if (m) return `कौशल: ${SKILLS[m[1].replace(/ /g, '_')] ?? m[1]}`
  m = /^(\w+) tier$/.exec(part)
  if (m) return `${TIERS[m[1]] ?? m[1]} टियर`
  return part
}

/** Backend match reason, e.g. "Hindi-speaking, 3.2 km away, free 10:00–16:00, standard tier". */
export function localizeMatchReason(reason: string, language: Lang): string {
  if (language !== 'hi' || !reason) return reason
  const tomorrow = /\s*\(next slot tomorrow\)$/.test(reason)
  const core = reason.replace(/\s*\(next slot tomorrow\)$/, '')
  return core.split(', ').map(reasonPart).join(', ') + (tomorrow ? ' (अगला समय कल)' : '')
}

const NOTE_COUNTS: [RegExp, string][] = [
  [/^(\d+) outside service radius$/, 'सेवा क्षेत्र से बाहर: $1'],
  [/^(\d+) without required skill \((.+)\)$/, 'ज़रूरी कौशल नहीं: $1'],
  [/^(\d+) below required tier$/, 'ज़रूरी टियर से नीचे: $1'],
]

export function localizeMatchingNote(note: string | null | undefined, language: Lang): string {
  if (!note || language !== 'hi') return note ?? ''
  if (note === 'Location not shared, so service radius and distance could not be verified.') {
    return 'स्थान साझा नहीं किया गया, इसलिए सेवा क्षेत्र और दूरी सत्यापित नहीं हो सकी।'
  }
  if (note === 'No eligible caregiver is free later today; showing the earliest slots tomorrow. Seek urgent care if symptoms worsen.') {
    return 'आज आगे कोई उपयुक्त केयरगिवर खाली नहीं है; कल के सबसे पहले समय दिखाए गए हैं। लक्षण बढ़ें तो तुरंत इलाज लें।'
  }
  const m = /^No eligible (\w+) found for this request(?:: (.+?)\.)? Try a teleconsultation, or call 112 if symptoms worsen\.$/.exec(note)
  if (m) {
    const detail = m[2]?.split(', ').map((item) => NOTE_COUNTS.reduce((text, [pattern, to]) => text.replace(pattern, to), item)).join(', ')
    return `इस अनुरोध के लिए कोई उपयुक्त ${ROLES[m[1]] ?? m[1]} नहीं मिला${detail ? ` (${detail})` : ''}। ऑनलाइन परामर्श आज़माएँ, या लक्षण बढ़ें तो 112 पर कॉल करें।`
  }
  return note
}

const ASSESSMENT: Record<string, string> = {
  'Respiratory symptoms; infection, allergy, and other causes are possible': 'सांस संबंधी लक्षण; संक्रमण, एलर्जी और अन्य कारण संभव हैं',
  'Fever or possible infection; the cause is undetermined': 'बुखार या संभावित संक्रमण; कारण अभी तय नहीं है',
  'Digestive symptoms; the cause is undetermined': 'पाचन संबंधी लक्षण; कारण अभी तय नहीं है',
  'Skin symptoms or a wound-care concern': 'त्वचा के लक्षण या घाव की देखभाल की चिंता',
  'Pain requiring assessment; the cause is undetermined': 'दर्द जिसकी जांच ज़रूरी है; कारण अभी तय नहीं है',
  'No illness category can be established from this request.': 'इस अनुरोध से किसी बीमारी की श्रेणी तय नहीं की जा सकती।',
  'Conflicting patient ages were reported; verify which patient needs care.': 'मरीज़ की अलग-अलग उम्र बताई गई है; पुष्टि करें कि किस मरीज़ को देखभाल चाहिए।',
  'Young child or older adult: professional assessment may be needed sooner.': 'छोटे बच्चे या बुज़ुर्ग: पेशेवर जांच जल्दी ज़रूरी हो सकती है।',
  'A child was described, but the exact age is unknown.': 'बच्चे के बारे में बताया गया है, पर सही उम्र पता नहीं है।',
  'Pregnancy reported.': 'गर्भावस्था बताई गई है।',
  'Reduced immunity reported.': 'कम रोग-प्रतिरोधक क्षमता बताई गई है।',
  'A potentially relevant long-term condition was reported in the patient history.': 'मरीज़ के इतिहास में एक संभावित रूप से प्रासंगिक दीर्घकालिक बीमारी बताई गई है।',
  'Patient age is unknown; adult vital-sign ranges may not apply.': 'मरीज़ की उम्र अज्ञात है; वयस्कों के वाइटल्स की सामान्य सीमा लागू नहीं हो सकती।',
  'Medical history, regular medicines, and allergies have not been provided.': 'चिकित्सा इतिहास, नियमित दवाइयाँ और एलर्जी की जानकारी नहीं दी गई है।',
  'Temperature is unknown.': 'तापमान पता नहीं है।',
  'Oxygen saturation is unknown.': 'ऑक्सीजन सैचुरेशन पता नहीं है।',
  'Pulse is unknown.': 'नाड़ी (पल्स) पता नहीं है।',
  'Reported oxygen saturation is 93-94%; seek urgent medical advice now, especially if below the patient\'s usual baseline.': 'बताया गया ऑक्सीजन सैचुरेशन 93-94% है; तुरंत चिकित्सा सलाह लें, खासकर अगर यह मरीज़ के सामान्य स्तर से कम है।',
  'A baby under 3 months with a temperature of 38 C or above needs urgent medical assessment now; do not rely on home remedies.': '3 महीने से छोटे शिशु को 38 C या उससे ज़्यादा बुखार हो तो तुरंत चिकित्सा जांच ज़रूरी है; घरेलू उपायों पर निर्भर न रहें।',
  'A baby under 6 months with a temperature of 39 C or above needs urgent medical assessment now.': '6 महीने से छोटे शिशु को 39 C या उससे ज़्यादा बुखार हो तो तुरंत चिकित्सा जांच ज़रूरी है।',
  'A very high reported temperature needs urgent professional assessment.': 'बहुत तेज़ बुखार की तुरंत पेशेवर जांच ज़रूरी है।',
  'The reported temperature could not be interpreted; verify the value and units.': 'बताया गया तापमान समझा नहीं जा सका; मान और इकाई की पुष्टि करें।',
  'The reported blood pressure is invalid; verify both readings.': 'बताया गया ब्लड प्रेशर सही नहीं है; दोनों रीडिंग की पुष्टि करें।',
  'Emergency help is requested or a potentially serious warning sign was reported. Do not wait for this chat or a demo booking.': 'आपातकालीन मदद माँगी गई है या गंभीर खतरे का संकेत बताया गया है। इस चैट या डेमो बुकिंग का इंतज़ार न करें।',
  'Call 112 now, or 102 for ambulance assistance in India. No service has been contacted by this app.': 'अभी 112 पर कॉल करें, या एम्बुलेंस के लिए 102 पर। इस ऐप ने किसी सेवा से संपर्क नहीं किया है।',
  'Tell the dispatcher the symptoms, exact pickup location, and any known conditions. Follow their instructions.': 'ऑपरेटर को लक्षण, सही लोकेशन और ज्ञात बीमारियाँ बताएँ। उनके निर्देशों का पालन करें।',
  'Do not drive yourself if seriously unwell. Do not give food or drink to someone who is drowsy or cannot swallow.': 'गंभीर रूप से बीमार हों तो खुद गाड़ी न चलाएँ। जो व्यक्ति उनींदा हो या निगल न सके उसे खाना या पानी न दें।',
  'Because of the patient\'s reported risk factors, contact a clinician promptly rather than relying on home care.': 'मरीज़ के बताए गए जोखिम कारकों के कारण घरेलू देखभाल पर निर्भर रहने के बजाय तुरंत डॉक्टर से संपर्क करें।',
  'Arrange a clinician review if symptoms persist, worsen, or concern you. This demo cannot establish that home care alone is appropriate.': 'लक्षण बने रहें, बढ़ें या चिंता हो तो डॉक्टर से जांच कराएँ। यह डेमो तय नहीं कर सकता कि सिर्फ़ घरेलू देखभाल काफ़ी है।',
  'Call 112 for new chest pain, severe breathing difficulty, collapse, severe bleeding, or other severe deterioration. Do not delay care to measure vitals.': 'सीने में नया दर्द, सांस लेने में गंभीर तकलीफ़, बेहोशी, भारी रक्तस्राव या अन्य गंभीर बिगड़ने पर 112 पर कॉल करें। वाइटल्स नापने में इलाज में देरी न करें।',
  'Rest while arranging appropriate care and monitor for worsening symptoms.': 'उचित देखभाल का इंतज़ाम करते समय आराम करें और लक्षण बढ़ने पर नज़र रखें।',
  'If fully awake and able to swallow, take small sips of fluid unless a clinician has restricted your fluids.': 'पूरी तरह होश में हों और निगल सकें तो थोड़ा-थोड़ा तरल लें, जब तक डॉक्टर ने मना न किया हो।',
  'Avoid unprescribed antibiotics or new medicines; ask a clinician or pharmacist about safe symptom relief and interactions.': 'बिना पर्चे की एंटीबायोटिक या नई दवाइयाँ न लें; सुरक्षित राहत और दवाओं के आपसी असर के बारे में डॉक्टर या फार्मासिस्ट से पूछें।',
  'Comfort measures may help while monitoring mild symptoms; this is not a diagnosis or clearance to stay home.': 'हल्के लक्षणों पर नज़र रखते समय आराम के उपाय मदद कर सकते हैं; यह निदान नहीं है और घर पर रहने की मंज़ूरी भी नहीं।',
  'A clinician should assess the reported symptoms and context; this demo cannot determine whether home care is sufficient.': 'बताए गए लक्षणों और स्थिति की जांच डॉक्टर को करनी चाहिए; यह डेमो तय नहीं कर सकता कि घरेलू देखभाल काफ़ी है या नहीं।',
  'Symptoms alone cannot distinguish viral, bacterial, or non-infectious causes. Examination or testing may be needed.': 'सिर्फ़ लक्षणों से वायरल, बैक्टीरियल या गैर-संक्रामक कारण में फ़र्क नहीं किया जा सकता। जांच या टेस्ट की ज़रूरत पड़ सकती है।',
  'Rule-based demo guidance, not a diagnosis or medical clearance. Serious illness can be missed. Seek urgent help for severe, new, or worsening symptoms.': 'नियम-आधारित डेमो मार्गदर्शन; यह निदान या चिकित्सा मंज़ूरी नहीं है। गंभीर बीमारी छूट सकती है। गंभीर, नए या बढ़ते लक्षणों पर तुरंत मदद लें।',
}

export function localizeAssessmentText(text: string, language: Lang): string {
  return language === 'hi' ? ASSESSMENT[text] ?? text : text
}

const ASSESSMENT_LABELS = {
  en: {
    heading: 'Clinical Safety Guidance & Missing Vitals', audit: '(clinical audit)', collapse: 'Collapse ▲', expand: 'View Checklist ▼',
    aria: 'Symptom safety guidance', categories: 'Possible symptom groups, not diagnoses', risks: 'Reported history and risk factors',
    next: 'What to do now', support: 'Comfort measures while arranging care', missing: 'Unknown or unverified information',
  },
  hi: {
    heading: 'सुरक्षा मार्गदर्शन और छूटी जानकारी', audit: '(क्लिनिकल ऑडिट)', collapse: 'छोटा करें ▲', expand: 'चेकलिस्ट देखें ▼',
    aria: 'लक्षणों का सुरक्षा मार्गदर्शन', categories: 'संभावित लक्षण समूह, निदान नहीं', risks: 'बताया गया इतिहास और जोखिम कारक',
    next: 'अभी क्या करें', support: 'देखभाल का इंतज़ाम करते समय आराम के उपाय', missing: 'अज्ञात या अपुष्ट जानकारी',
  },
}
export const assessmentLabels = (language: Lang) => ASSESSMENT_LABELS[language]
