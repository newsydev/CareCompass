const supported = () =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

/** Lower-cased language tags of every installed voice (empty until the browser has loaded them). */
export function voiceLangs(): string[] {
  if (!supported()) return []
  return window.speechSynthesis.getVoices().map((voice) => (voice.lang || '').replace('_', '-').toLowerCase())
}

export function stopNarration() {
  if (supported()) window.speechSynthesis.cancel()
}

export function narrate(text: string, locale: string) {
  if (!supported()) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = locale
  const prefix = locale.split('-')[0].toLowerCase()
  const matching = window.speechSynthesis.getVoices().filter((voice) => {
    const lang = (voice.lang || '').replace('_', '-').toLowerCase()
    return lang.startsWith(prefix) || (prefix === 'hi' && voice.name.toLowerCase().includes('hindi'))
  })
  const voice = matching.find((candidate) => candidate.localService) ?? matching[0]
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}
