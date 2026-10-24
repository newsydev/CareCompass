import { useMutation } from '@tanstack/react-query'
import { submitTriage } from '../api/careNavigation'

export function useTriage() {
  return useMutation({
    mutationFn: submitTriage,
  })
}
