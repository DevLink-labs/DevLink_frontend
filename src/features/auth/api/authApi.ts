import { apiClient } from '../../../lib/apiClient'
import type { LoginInput, SignupInput, User } from '../types'

export const authApi = {
  health: (signal?: AbortSignal) => apiClient.get<string>('/health', signal),
  getMe: (signal?: AbortSignal) => apiClient.get<User>('/auth/users/me', signal),
  signup: (input: SignupInput) => apiClient.post<User>('/auth/signup', {
    email: input.email.trim(),
    password: input.password,
    name: input.name.trim(),
    ...(input.nickname?.trim() ? { nickname: input.nickname.trim() } : {}),
  }),
  login: (input: LoginInput) => apiClient.post<User>('/auth/login', {
    email: input.email.trim(), password: input.password,
  }),
  logout: () => apiClient.post<null>('/auth/logout'),
}
