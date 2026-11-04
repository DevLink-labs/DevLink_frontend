import { createContext, useContext } from 'react'
import type { User } from '../types'

export type ConnectionState = 'checking' | 'online' | 'offline'

export interface SessionValue {
  user: User | null
  booting: boolean
  connection: ConnectionState
  loggingOut: boolean
  onAuthenticated: (user: User) => Promise<void>
  logout: () => void
  retryConnection: () => void
  onError: (error: unknown) => void
}

export const SessionContext = createContext<SessionValue | null>(null)

export function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('SessionProvider가 필요합니다.')
  return session
}
