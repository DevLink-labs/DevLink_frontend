import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './apiClient'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => failureCount < 1
        && error instanceof ApiError && (error.status === 0 || error.status >= 500),
    },
    mutations: { retry: false },
  },
})
