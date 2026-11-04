import { apiClient } from '../../../lib/apiClient'
import type { Agent, AgentTokenResult, CreateAgentInput, UpdateAgentInput } from '../types'

export const agentApi = {
  listAgents: (teamId: number, signal?: AbortSignal) => apiClient.get<Agent[]>(`/agents/teams/${teamId}`, signal),
  getAgent: (agentId: number, signal?: AbortSignal) => apiClient.get<Agent>(`/agents/${agentId}`, signal),
  updateAgent: (agentId: number, input: UpdateAgentInput) => apiClient.patch<Agent>(`/agents/${agentId}`, {
    name: input.name?.trim(),
    roleDescription: input.roleDescription?.trim(),
    projectName: input.projectName?.trim(),
  }),
  deleteAgent: (agentId: number) => apiClient.delete<null>(`/agents/${agentId}`),
  registerAgent: (teamId: number, input: CreateAgentInput) => apiClient.post<Agent>(`/agents/teams/${teamId}`, {
    name: input.name.trim(),
    roleDescription: input.roleDescription?.trim() || null,
    toolType: input.toolType,
    projectName: input.projectName.trim(),
  }),
  issueAgentToken: (agentId: number) => apiClient.post<AgentTokenResult>(`/agents/${agentId}/token`),
}
