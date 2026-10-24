import { useEffect, useState } from 'react'
import type { Location } from '../api/types'

// Falls back to the Delhi/NCR demo coordinates used throughout the API docs
// when the browser denies/lacks geolocation — matching will still run, just
// without an accurate distance score.
const FALLBACK_LOCATION: Location = { lat: 28.54, lng: 77.27 }

export function useGeolocation() {
  const [location, setLocation] = useState<Location>(FALLBACK_LOCATION)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude })
      },
      () => {
        setPermissionDenied(true)
      },
      { timeout: 8000 },
    )
  }, [])

  return { location, permissionDenied }
}
