export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[CareCompass PWA] Service Worker registered with scope:', registration.scope)
        })
        .catch((error) => {
          console.warn('[CareCompass PWA] Service Worker registration failed:', error)
        })
    })
  }
}
