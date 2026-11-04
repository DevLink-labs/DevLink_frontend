import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teamApi } from '../api/teamApi'

export const teamKeys = {
  all: (userId: number) => ['workspace', userId, 'teams'] as const,
  list: (userId: number) => [...teamKeys.all(userId), 'list'] as const,
  detail: (userId: number, teamId: number | null) => [...teamKeys.all(userId), teamId] as const,
  members: (userId: number, teamId: number | null) => [...teamKeys.detail(userId, teamId), 'members'] as const,
}

export function useTeams(userId: number) {
  return useQuery({
    queryKey: teamKeys.list(userId),
    queryFn: ({ signal }) => teamApi.listTeams(signal),
  })
}

export function useTeam(userId: number, teamId: number | null) {
  return useQuery({
    queryKey: teamKeys.detail(userId, teamId),
    queryFn: ({ signal }) => teamApi.getTeam(teamId!, signal),
    enabled: teamId !== null,
  })
}

export function useTeamMembers(userId: number, teamId: number | null) {
  return useQuery({
    queryKey: teamKeys.members(userId, teamId),
    queryFn: ({ signal }) => teamApi.getTeamMembers(teamId!, signal),
    enabled: teamId !== null,
  })
}

export function useTeamMutations(userId: number) {
  const queryClient = useQueryClient()
  const refreshTeams = () => queryClient.invalidateQueries({ queryKey: teamKeys.all(userId) })
  const createTeam = useMutation({
    mutationFn: teamApi.createTeam,
    onSuccess: refreshTeams,
    gcTime: 0,
  })
  const joinTeam = useMutation({
    mutationFn: teamApi.joinTeam,
    onSuccess: refreshTeams,
  })
  const regenerateInvite = useMutation({
    mutationFn: teamApi.regenerateInvite,
    gcTime: 0,
  })

  return { createTeam, joinTeam, regenerateInvite }
}
