import { useQuery } from '@tanstack/react-query'
import { getCaregivers } from '../api/careNavigation'

export function useCaregivers() {
  return useQuery({
    queryKey: ['caregivers'],
    queryFn: getCaregivers,
    staleTime: 5 * 60 * 1000,
  })
}
