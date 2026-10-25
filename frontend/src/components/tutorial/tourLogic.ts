import type { TourLang, TourStep } from './steps'

export function clampIndex(index: number, length: number) {
  if (length <= 0) return 0
  return Math.min(Math.max(index, 0), length - 1)
}

/** Index after moving one step in a direction, or null when that runs off either end. */
export function stepAfter(index: number, direction: 1 | -1, length: number) {
  const next = index + direction
  return next < 0 || next >= length ? null : next
}

export function pathOf(route: string) {
  return route.split('?')[0]
}

export function routeMatches(pathname: string, route: string) {
  return pathname === pathOf(route)
}

export function narrationText(step: TourStep, language: TourLang) {
  return `${step.title[language]}. ${step.body[language]}`
}

export function localeFor(language: TourLang) {
  return language === 'hi' ? 'hi-IN' : 'en-IN'
}

export function targetSelector(step: TourStep) {
  return `[data-tour="${step.target}"]`
}
