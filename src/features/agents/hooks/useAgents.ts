import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/lib/apiClient'
import { agentApi } from '../api/agentApi'
import type { CreateAgentInput, UpdateAgentInput } from '../types'

export const agentKeys = {
  all: (userId: number) => ['workspace', userId, 'agents'] as const,
  list: (userId: number, teamId: number | null) => [...agentKeys.all(userId), 'team', teamId] as const,
  detail: (userId: number, agentId: number | null) => [...agentKeys.all(userId), 'detail', agentId] as const,
}

export function isAgentAccessError(error: unknown) {
  return error instanceof ApiError && [401, 403, 404].includes(error.status)
}

export function useAgents(userId: number, teamId: number | null, refreshPresence = false) {
  return useQuery({
    queryKey: agentKeys.list(userId, teamId),
    queryFn: ({ signal }) => agentApi.listAgents(teamId!, signal),
    enabled: teamId !== null,
    refetchInterval: refreshPresence
      ? ({ state }) => isAgentAccessError(state.error) ? false : 5_000
      : false,
    ...(refreshPresence ? { refetchIntervalInBackground: false, refetchOnWindowFocus: 'always' as const } : {}),
  })
}

export function useAgent(userId: number, agentId: number | null) {
  return useQuery({
    queryKey: agentKeys.detail(userId, agentId),
    queryFn: ({ signal }) => agentApi.getAgent(agentId!, signal),
    enabled: agentId !== null,
    staleTime: 0,
  })
}

export function useAgentMutations(userId: number, teamId: number) {
  const queryClient = useQueryClient()
  const refreshAgents = () => queryClient.invalidateQueries({ queryKey: agentKeys.list(userId, teamId) })
  const refreshAgent = (agentId: number) => Promise.all([
    refreshAgents(),
    queryClient.invalidateQueries({ queryKey: agentKeys.detail(userId, agentId) }),
  ])
  const registerAgent = useMutation({
    mutationFn: (input: CreateAgentInput) => agentApi.registerAgent(teamId, input),
    onSuccess: refreshAgents,
  })
  const updateAgent = useMutation({
    mutationFn: ({ agentId, input }: { agentId: number; input: UpdateAgentInput }) => agentApi.updateAgent(agentId, input),
    onSuccess: (_result, { agentId }) => refreshAgent(agentId),
  })
  const deleteAgent = useMutation({
    mutationFn: agentApi.deleteAgent,
    onSuccess: (_result, agentId) => {
      queryClient.removeQueries({ queryKey: agentKeys.detail(userId, agentId) })
      return refreshAgents()
    },
  })
  const issueAgentToken = useMutation({
    mutationFn: agentApi.issueAgentToken,
    onSuccess: (_result, agentId) => { void refreshAgent(agentId) },
    gcTime: 0,
  })

  return { registerAgent, updateAgent, deleteAgent, issueAgentToken }
}
