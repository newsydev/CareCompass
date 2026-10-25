import { createContext, useContext } from 'react'

export interface TutorialApi {
  /** Opens the language prompt, then runs the guided tour. */
  start: () => void
  active: boolean
}

export const TutorialContext = createContext<TutorialApi | null>(null)

export function useTutorial() {
  const api = useContext(TutorialContext)
  if (!api) throw new Error('TutorialProvider is required.')
  return api
}
