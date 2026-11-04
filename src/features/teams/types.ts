export type TeamRole = 'OWNER' | 'MEMBER'

export interface Team {
  teamId: number
  name: string
  myRole: TeamRole
  createdAt: string
}

export interface TeamMember {
  userId: number
  name: string
  nickname: string | null
  role: TeamRole
  joinedAt: string
}

export interface CreateTeamResult extends Team {
  inviteCode: string
}

export interface JoinTeamResult {
  teamId: number
  name: string
  myRole: TeamRole
  joinedAt: string
  replayed: boolean
}

export interface TeamInviteResult {
  teamId: number
  inviteCode: string
}
