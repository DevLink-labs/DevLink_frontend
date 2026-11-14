import { useTranslation } from "@/lib/i18n";
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../../lib/apiClient'
import { useNotice } from '../../../hooks/useNotice'
import { authApi } from '../api/authApi'
import { authKeys } from '../api/authKeys'
import { SessionContext } from '../hooks/useSession'
import type { SessionValue } from '../hooks/useSession'
import type { User } from '../types'

export default function SessionProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const client = useQueryClient()
  const notify = useNotice()
  const channel = useRef<BroadcastChannel | null>(null)
  const sessionVersion = useRef(0)
  const previousUserId = useRef<number | null>(null)
  const expiring = useRef(false)
  const [connectionErrorAt, setConnectionErrorAt] = useState(0)
  const [connectionSuccessAt, setConnectionSuccessAt] = useState(0)

  const clearWorkspace = useCallback(async () => {
    await client.cancelQueries({ queryKey: ['workspace'] })
    client.removeQueries({ queryKey: ['workspace'] })
  }, [client])

  const applySession = useCallback(async (user: User | null, broadcast = false) => {
    const version = ++sessionVersion.current
    await client.cancelQueries({ queryKey: authKeys.session })
    await clearWorkspace()
    if (version !== sessionVersion.current) return
    client.setQueryData(authKeys.session, user)
    if (broadcast) channel.current?.postMessage('changed')
  }, [client, clearWorkspace])

  const session = useQuery({
    queryKey: authKeys.session,
    queryFn: async ({ signal }) => {
      try {
        return await authApi.getMe(signal)
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearWorkspace()
          return null
        }
        throw error
      }
    },
    staleTime: 0,
    retry: false,
  })
  const health = useQuery({
    queryKey: authKeys.health,
    queryFn: ({ signal }) => authApi.health(signal),
    retry: false,
  })

  const onError = useCallback((error: unknown) => {
    if (error instanceof ApiError && error.status === 401 && error.code !== 'INVALID_CREDENTIALS') {
      if (!expiring.current && client.getQueryData<User | null>(authKeys.session)) {
        expiring.current = true
        void applySession(null).finally(() => { expiring.current = false })
        notify(t("로그인 세션이 만료되었습니다. 다시 로그인해주세요."), 'error')
      }
      return
    }
    if (error instanceof ApiError && error.status === 0) setConnectionErrorAt(Date.now())
    notify(error instanceof Error ? error.message : t("요청을 처리하지 못했습니다."), 'error')
  }, [applySession, client, notify, t])

  useEffect(() => {
    const unsubscribeQueries = client.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated') return
      if (event.action.type === 'success') setConnectionSuccessAt(Date.now())
      const currentUserId = client.getQueryData<User | null>(authKeys.session)?.userId
      if (event.action.type === 'error' && event.query.queryKey[0] === 'workspace'
        && event.query.queryKey[1] === currentUserId
        && event.action.error instanceof ApiError && event.action.error.status === 401) {
        onError(event.action.error)
      }
    })
    const unsubscribeMutations = client.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'success') setConnectionSuccessAt(Date.now())
    })
    if ('BroadcastChannel' in window) {
      const authChannel = new BroadcastChannel('devlink-session')
      channel.current = authChannel
      authChannel.onmessage = () => {
        void applySession(null).then(() => client.invalidateQueries({ queryKey: authKeys.session }))
      }
    }
    return () => {
      unsubscribeQueries()
      unsubscribeMutations()
      channel.current?.close()
      channel.current = null
    }
  }, [applySession, client, onError])

  const userId = session.data?.userId ?? null
  useEffect(() => {
    const previous = previousUserId.current
    previousUserId.current = userId
    if (previous === userId) return
    sessionVersion.current++
    if (previous === null) return
    void client.cancelQueries({ queryKey: ['workspace', previous] }).then(() => {
      client.removeQueries({ queryKey: ['workspace', previous] })
    })
  }, [client, userId])

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onMutate: () => sessionVersion.current,
    onSuccess: async (_result, _variables, version) => {
      if (version !== sessionVersion.current) return
      await applySession(null, true)
      notify(t("로그아웃했습니다."))
    },
    onError: (error, _variables, version) => {
      if (version === sessionVersion.current) onError(error)
    },
  })

  const onAuthenticated = useCallback(async (user: User) => {
    await applySession(user, true)
    void client.invalidateQueries({ queryKey: authKeys.health })
    notify(t("{{name}}님, 반가워요!", { name: user.nickname || user.name }))
  }, [applySession, client, notify, t])

  const retryConnection = () => {
    void client.invalidateQueries({ queryKey: authKeys.session })
    void client.invalidateQueries({ queryKey: authKeys.health })
  }
  const latestSuccess = Math.max(health.dataUpdatedAt, session.dataUpdatedAt, connectionSuccessAt)
  const latestError = Math.max(health.errorUpdatedAt, session.errorUpdatedAt, connectionErrorAt)
  const connection = health.isFetching && health.data === undefined
    ? 'checking'
    : latestSuccess > latestError ? 'online' : 'offline'

  const value: SessionValue = {
    user: session.data ?? null,
    booting: session.isPending,
    connection,
    loggingOut: logoutMutation.isPending,
    onAuthenticated,
    logout: () => logoutMutation.mutate(),
    retryConnection,
    onError,
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
