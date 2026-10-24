import { useQuery } from '@tanstack/react-query'
import { getTaxonomy } from '../api/careNavigation'

export function useTaxonomy() {
  return useQuery({
    queryKey: ['taxonomy'],
    queryFn: getTaxonomy,
    staleTime: Infinity,
  })
}
