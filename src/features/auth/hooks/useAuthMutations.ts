import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/authApi'

export function useAuthMutations() {
  const login = useMutation({
    mutationFn: authApi.login,
    retry: false,
    gcTime: 0,
  })
  const signup = useMutation({
    mutationFn: authApi.signup,
    retry: false,
    gcTime: 0,
  })

  return { login, signup }
}
