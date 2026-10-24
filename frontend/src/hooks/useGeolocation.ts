import { useState } from 'react'
import type { Location } from '../api/types'

export function useGeolocation(savedLocation: Location | null = null) {
  const [location, setLocation] = useState<Location | null>(savedLocation)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function requestLocation() {
    setError(null)
    if (!navigator.geolocation) {
      setError('This browser cannot share your location. You can still request care.')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
        setIsLocating(false)
      },
      (failure) => {
        switch (failure.code) {
          case 1:
            setError('Location access was denied. Allow location for this site and enable Location Services for your browser or Copilot app in macOS System Settings > Privacy & Security > Location Services, then try again.')
            break
          case 2:
            setError('Your browser could not determine your location. Check macOS Location Services and your network connection. If you are using the embedded preview, try opening the app in Safari or Chrome.')
            break
          case 3:
            setError('Finding your location timed out. Check your connection and try again, or open the app in Safari or Chrome.')
            break
          default:
            setError(`Location lookup failed: ${failure.message || 'Unknown browser error'}. You can still enter your care address and request care without sharing your location.`)
        }
        setIsLocating(false)
      },
      { timeout: 20000, maximumAge: 60000, enableHighAccuracy: false },
    )
  }

  return { location, isLocating, error, requestLocation }
}
