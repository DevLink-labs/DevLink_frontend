import { apiClient } from '../../../lib/apiClient'
import type { CreateTeamResult, JoinTeamResult, Team, TeamInviteResult, TeamMember } from '../types'

export const teamApi = {
  listTeams: (signal?: AbortSignal) => apiClient.get<Team[]>('/teams', signal),
  getTeam: (teamId: number, signal?: AbortSignal) => apiClient.get<Team>(`/teams/${teamId}`, signal),
  createTeam: (name: string) => apiClient.post<CreateTeamResult>('/teams', { name: name.trim() }),
  joinTeam: (inviteCode: string) => apiClient.post<JoinTeamResult>('/teams/join', { inviteCode: inviteCode.trim() }),
  getTeamMembers: (teamId: number, signal?: AbortSignal) => apiClient.get<TeamMember[]>(`/teams/${teamId}/members`, signal),
  regenerateInvite: (teamId: number) => apiClient.post<TeamInviteResult>(`/teams/${teamId}/invites`),
}
