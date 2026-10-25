// Strong repeating vibration for the emergency alert. The Web Vibration API only works on Android
// Chrome/Firefox after a user interaction, and it cannot override silent/DND/battery-saver settings.
export const ALERT_PATTERN = [600, 200, 600, 200, 600, 200, 1000]
const REPEAT_MS = 4000
const MAX_MS = 60000

export function canVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

function buzz(pattern: number | number[]) {
  try {
    return navigator.vibrate(pattern)
  } catch {
    return false
  }
}

/** Starts repeating vibration and returns a stop function. Safe to call where vibration is unsupported. */
export function startAlertVibration(options: { repeatMs?: number; maxMs?: number } = {}) {
  if (!canVibrate()) return () => undefined
  const { repeatMs = REPEAT_MS, maxMs = MAX_MS } = options
  let stopped = false
  buzz(ALERT_PATTERN)
  const repeat = setInterval(() => buzz(ALERT_PATTERN), repeatMs)
  const hardStop = setTimeout(stop, maxMs)

  function stop() {
    if (stopped) return
    stopped = true
    clearInterval(repeat)
    clearTimeout(hardStop)
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
    buzz(0)
  }
  function onVisibility() {
    if (document.visibilityState === 'hidden') stop()
  }
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
  return stop
}
