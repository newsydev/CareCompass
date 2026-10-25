import type { TourLang } from './steps'

const en = {
  promptTitle: 'Start tutorial in / ट्यूटोरियल किस भाषा में?',
  promptHint: 'The tour will also be read aloud in this language.',
  english: 'English',
  hindi: 'हिन्दी',
  cancel: 'Cancel',
  next: 'Next',
  back: 'Back',
  done: 'Done',
  skip: 'Skip tutorial',
  dialog: 'App tutorial',
  mute: 'Mute narration',
  unmute: 'Play narration',
  noHindiVoice: 'No Hindi voice is installed on this device, so you will only see the text.',
}

export type TourStrings = typeof en

const hi: TourStrings = {
  promptTitle: 'Start tutorial in / ट्यूटोरियल किस भाषा में?',
  promptHint: 'यह टूर इसी भाषा में बोलकर भी सुनाया जाएगा।',
  english: 'English',
  hindi: 'हिन्दी',
  cancel: 'रद्द करें',
  next: 'आगे',
  back: 'पीछे',
  done: 'पूरा हुआ',
  skip: 'ट्यूटोरियल छोड़ें',
  dialog: 'ऐप ट्यूटोरियल',
  mute: 'आवाज़ बंद करें',
  unmute: 'आवाज़ चालू करें',
  noHindiVoice: 'इस डिवाइस में हिंदी आवाज़ इंस्टॉल नहीं है, इसलिए आपको सिर्फ़ टेक्स्ट दिखेगा।',
}

export const tourStrings: Record<TourLang, TourStrings> = { en, hi }

export const stepCounter = (index: number, total: number, language: TourLang) =>
  language === 'hi' ? `चरण ${index + 1} / ${total}` : `Step ${index + 1} of ${total}`
