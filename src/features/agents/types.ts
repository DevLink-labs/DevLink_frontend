export type ToolType = 'CODEX' | 'CLAUDE_CODE'

export interface Agent {
  agentId: number
  teamId: number
  ownerUserId: number
  name: string
  roleDescription: string | null
  toolType: ToolType
  projectName: string
  status: 'ONLINE' | 'OFFLINE'
  lastSeenAt: string | null
  createdAt: string
}

export interface CreateAgentInput {
  name: string
  roleDescription?: string | null
  toolType: ToolType
  projectName: string
}

export interface UpdateAgentInput {
  name?: string
  roleDescription?: string
  projectName?: string
}

export interface AgentTokenResult {
  agentId: number
  token: string
}
