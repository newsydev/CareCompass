import type { UiLanguage } from '../../utils/i18n'

const en = {
  headline: 'Emergency: get help now',
  crisisHeadline: 'You are not alone: get help now',
  body: 'Call for help right now. Do not wait for a reply or a caregiver match.',
  crisisBody: 'If you might hurt yourself, call 112 now and stay with someone you trust. Free, confidential support is available at any hour.',
  honest: 'This app cannot dispatch an ambulance. The buttons below place a phone call from your phone.',
  call112: 'Call 112 now',
  call102: 'Call ambulance (102)',
  callLine: (name: string, number: string) => `Call ${name} ${number}`,
  dismiss: 'I am safe, dismiss alert',
  alertLabel: 'Emergency alert',
  crisisReply: 'I am concerned about your safety. You are not alone. Please call 112 or Tele-MANAS 14416 right now, and stay with someone you trust. This app cannot send an ambulance or contact anyone for you.',
  spoken: 'Please call 112 right now. This app cannot send an ambulance. Opening the chat.',
  crisisSpoken: 'You are not alone. Please call 112 or Tele-MANAS 14416 right now, and stay with someone you trust. Opening the chat.',
  names: { '112': 'National emergency 112', '102': 'Ambulance 102', '14416': 'Tele-MANAS', '18005990019': 'KIRAN' } as Record<string, string>,
}

export type EmergencyStrings = typeof en

const hi: EmergencyStrings = {
  headline: 'आपातकाल: अभी मदद लें',
  crisisHeadline: 'आप अकेले नहीं हैं: अभी मदद लें',
  body: 'अभी मदद के लिए कॉल करें। जवाब या केयरगिवर मिलने का इंतज़ार न करें।',
  crisisBody: 'अगर आप खुद को नुकसान पहुँचा सकते हैं, तो अभी 112 पर कॉल करें और किसी भरोसेमंद व्यक्ति के साथ रहें। मुफ़्त और गोपनीय सहायता हर समय उपलब्ध है।',
  honest: 'यह ऐप एम्बुलेंस नहीं भेज सकता। नीचे के बटन आपके फ़ोन से कॉल लगाते हैं।',
  call112: 'अभी 112 पर कॉल करें',
  call102: 'एम्बुलेंस (102) पर कॉल करें',
  callLine: (name: string, number: string) => `${name} ${number} पर कॉल करें`,
  dismiss: 'मैं सुरक्षित हूँ, अलर्ट बंद करें',
  alertLabel: 'आपातकालीन अलर्ट',
  crisisReply: 'मुझे आपकी सुरक्षा की चिंता है। आप अकेले नहीं हैं। कृपया अभी 112 या टेली-मानस 14416 पर कॉल करें, और किसी भरोसेमंद व्यक्ति के साथ रहें। यह ऐप एम्बुलेंस नहीं भेज सकता और आपकी ओर से किसी से संपर्क नहीं कर सकता।',
  spoken: 'कृपया अभी 112 पर कॉल करें। यह ऐप एम्बुलेंस नहीं भेज सकता। अब चैट खुल रही है।',
  crisisSpoken: 'आप अकेले नहीं हैं। कृपया अभी 112 या टेली-मानस 14416 पर कॉल करें, और किसी भरोसेमंद व्यक्ति के साथ रहें। अब चैट खुल रही है।',
  names: { '112': 'राष्ट्रीय आपातकाल 112', '102': 'एम्बुलेंस 102', '14416': 'टेली-मानस', '18005990019': 'किरण' },
}

export function emergencyStrings(language: UiLanguage): EmergencyStrings {
  return language === 'hi' ? hi : en
}
