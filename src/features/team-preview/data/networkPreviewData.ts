import type { PreviewTeam } from './previewData'

export interface DemoExchange {
  id: string
  fromId: string
  toId: string
  label: string
}

export function getNetworkEntries(team: PreviewTeam) {
  return team.members.flatMap((member) => member.agents.map((agent) => ({ agent, member })))
}

export function getDemoExchanges(team: PreviewTeam): DemoExchange[] {
  const online = getNetworkEntries(team).filter(({ agent }) => agent.online)
  if (online.length < 2) return []
  if (online.length < 4) return [{ id: 'exchange-1', fromId: online[0].agent.id, toId: online[1].agent.id, label: '작업 내용 공유' }]
  return [
    { id: 'exchange-1', fromId: online[0].agent.id, toId: online[2].agent.id, label: '작업 내용 공유' },
    { id: 'exchange-2', fromId: online[1].agent.id, toId: online[3].agent.id, label: '변경 사항 전달' },
  ]
}
