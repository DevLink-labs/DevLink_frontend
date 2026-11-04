import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useSession } from '../../auth/hooks/useSession'
import { authKeys } from '../../auth/api/authKeys'
import { useTeams, useTeam, useTeamMembers, teamKeys } from '../../teams/hooks/useTeams'
import { useAgents, agentKeys } from '../../agents/hooks/useAgents'

export function useWorkspace(userId: number) {
  const client = useQueryClient()
  const { onError } = useSession()
  const [preferredTeamId, setPreferredTeamId] = useState<number | null>(null)
  const teamsQuery = useTeams(userId)
  const teams = teamsQuery.data ?? []
  const selectedTeamId = teams.find((team) => team.teamId === preferredTeamId)?.teamId
    ?? teams[0]?.teamId ?? null
  const teamQuery = useTeam(userId, selectedTeamId)
  const membersQuery = useTeamMembers(userId, selectedTeamId)
  const agentsQuery = useAgents(userId, selectedTeamId)
  const error = teamsQuery.error ?? teamQuery.error ?? membersQuery.error ?? agentsQuery.error

  useEffect(() => {
    if (error) onError(error)
  }, [error, onError])

  const refreshWorkspace = () => {
    if (selectedTeamId === null) return
    void client.invalidateQueries({ queryKey: teamKeys.detail(userId, selectedTeamId) })
    void client.invalidateQueries({ queryKey: agentKeys.list(userId, selectedTeamId) })
  }

  const refreshAll = () => {
    void client.invalidateQueries({ queryKey: authKeys.session })
    void client.invalidateQueries({ queryKey: authKeys.health })
    void client.invalidateQueries({ queryKey: ['workspace', userId] })
  }

  return {
    teams,
    selectedTeamId,
    selectedTeam: teamQuery.data ?? teams.find((team) => team.teamId === selectedTeamId) ?? null,
    members: membersQuery.data ?? [],
    agents: agentsQuery.data ?? [],
    teamsLoading: teamsQuery.isFetching,
    workspaceLoading: selectedTeamId !== null
      && (teamQuery.isFetching || membersQuery.isFetching || agentsQuery.isFetching),
    workspaceError: error instanceof Error ? error.message : null,
    selectTeam: (teamId?: number) => setPreferredTeamId(teamId ?? null),
    refreshWorkspace,
    refreshAll,
  }
}
