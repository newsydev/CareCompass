export type TourLang = 'en' | 'hi'

export interface TourStep {
  id: string
  /** Route that must be showing before the target exists. */
  route: string
  /** Value of the data-tour attribute on the element to highlight. */
  target: string
  title: Record<TourLang, string>
  body: Record<TourLang, string>
}

// Only features that exist today are described; call/video consults are "coming soon".
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'nav', route: '/home', target: 'bottom-nav',
    title: { en: 'Bottom menu', hi: 'नीचे का मेन्यू' },
    body: {
      en: 'Use this bar to move around. Home is your start page, Consult is where you talk to the AI doctor, and Partners lists doctors, nurses and caregivers.',
      hi: 'इस बार से आप एक पेज से दूसरे पर जाते हैं। होम आपका शुरुआती पेज है, कंसल्ट में आप AI डॉक्टर से बात करते हैं, और पार्टनर्स में डॉक्टर, नर्स और केयरगिवर दिखते हैं।',
    },
  },
  {
    id: 'start', route: '/home', target: 'start-consultation',
    title: { en: 'Talk to the AI doctor', hi: 'AI डॉक्टर से बात करें' },
    body: {
      en: 'Tap Start Consultation, choose English or Hindi, and just speak your problem. The AI answers by voice. You can switch to chat any time.',
      hi: 'स्टार्ट कंसल्टेशन दबाएँ, हिंदी या अंग्रेज़ी चुनें और बस अपनी तकलीफ़ बोलें। AI आवाज़ में जवाब देगा। आप कभी भी चैट में जा सकते हैं।',
    },
  },
  {
    id: 'vitals', route: '/home', target: 'vitals',
    title: { en: 'Your vitals', hi: 'आपके वाइटल्स' },
    body: {
      en: 'Add your health readings here and see your latest values in one place.',
      hi: 'यहाँ अपनी सेहत की रीडिंग जोड़ें और अपनी ताज़ा वैल्यू एक जगह देखें।',
    },
  },
  {
    id: 'modes', route: '/consult', target: 'consult-modes',
    title: { en: 'Choose how to consult', hi: 'सलाह का तरीका चुनें' },
    body: {
      en: 'Chat with AI works now, in English or Hindi. A call from the AI doctor and video consultation with a doctor are coming soon.',
      hi: 'AI से चैट अभी चालू है, हिंदी या अंग्रेज़ी में। AI डॉक्टर का कॉल और डॉक्टर से वीडियो कंसल्टेशन जल्द आ रहे हैं।',
    },
  },
  {
    id: 'recent', route: '/consult', target: 'recent',
    title: { en: 'Recent consultations', hi: 'हाल की सलाह' },
    body: {
      en: 'Your earlier conversations are listed here. Tap one to open it and continue.',
      hi: 'आपकी पिछली बातचीत यहाँ दिखती है। किसी पर दबाकर उसे खोलें और आगे बढ़ें।',
    },
  },
  {
    id: 'quick', route: '/triage', target: 'chat-quick',
    title: { en: 'Quick symptom options', hi: 'लक्षण के तुरंत विकल्प' },
    body: {
      en: 'Tap one of these to start quickly, or type or speak your own problem below.',
      hi: 'जल्दी शुरू करने के लिए इनमें से एक दबाएँ, या नीचे अपनी तकलीफ़ लिखें या बोलें।',
    },
  },
  {
    id: 'speaker', route: '/triage', target: 'chat-speaker',
    title: { en: 'Listen to replies', hi: 'जवाब सुनें' },
    body: {
      en: 'The speaker icon on a message reads it aloud, in Hindi or English depending on that message.',
      hi: 'मैसेज पर स्पीकर आइकन उसे ज़ोर से पढ़ता है, उस मैसेज की भाषा के हिसाब से हिंदी या अंग्रेज़ी में।',
    },
  },
  {
    id: 'mic', route: '/triage', target: 'chat-mic',
    title: { en: 'Speak your problem', hi: 'अपनी तकलीफ़ बोलें' },
    body: {
      en: 'Tap the microphone and speak. Your words appear in the box so you can check them before sending.',
      hi: 'माइक दबाकर बोलें। आपके शब्द बॉक्स में दिखेंगे ताकि भेजने से पहले आप उन्हें देख सकें।',
    },
  },
  {
    id: 'partners-filter', route: '/partners', target: 'partners-filter',
    title: { en: 'Find a partner', hi: 'पार्टनर खोजें' },
    body: {
      en: 'Filter by role, or search by name, skill or area.',
      hi: 'भूमिका से फ़िल्टर करें, या नाम, स्किल या इलाके से खोजें।',
    },
  },
  {
    id: 'partners-list', route: '/partners', target: 'partners-list',
    title: { en: 'Partner cards', hi: 'पार्टनर कार्ड' },
    body: {
      en: 'Each card shows the role, rating, languages and available hours of a caregiver.',
      hi: 'हर कार्ड में केयरगिवर की भूमिका, रेटिंग, भाषाएँ और उपलब्ध समय दिखता है।',
    },
  },
  {
    id: 'personal', route: '/profile', target: 'profile-personal',
    title: { en: 'Personal information', hi: 'व्यक्तिगत जानकारी' },
    body: {
      en: 'Your name, date of birth, gender and blood group. Tap the pencil to edit.',
      hi: 'आपका नाम, जन्म तिथि, लिंग और ब्लड ग्रुप। बदलने के लिए पेंसिल दबाएँ।',
    },
  },
  {
    id: 'medical', route: '/profile', target: 'profile-medical',
    title: { en: 'Medical history', hi: 'चिकित्सा इतिहास' },
    body: {
      en: 'Keep your allergies, past history, medicines and family history here. Tap the pencil to edit.',
      hi: 'अपनी एलर्जी, पिछला इतिहास, दवाइयाँ और पारिवारिक इतिहास यहाँ रखें। बदलने के लिए पेंसिल दबाएँ।',
    },
  },
  {
    id: 'more', route: '/profile', target: 'profile-more',
    title: { en: 'More', hi: 'और विकल्प' },
    body: {
      en: 'Open prescriptions, reports and support here, and change the language. Uploads and support tickets are coming soon.',
      hi: 'यहाँ से प्रिस्क्रिप्शन, रिपोर्ट और सहायता खोलें और भाषा बदलें। अपलोड और सपोर्ट टिकट जल्द आ रहे हैं।',
    },
  },
  {
    id: 'logout', route: '/profile', target: 'profile-logout',
    title: { en: 'Log out', hi: 'लॉग आउट' },
    body: {
      en: 'Tap here to log out of this device when you are done.',
      hi: 'काम पूरा होने पर इस डिवाइस से लॉग आउट करने के लिए यहाँ दबाएँ।',
    },
  },
]
