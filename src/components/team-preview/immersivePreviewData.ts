import { previewTeams } from './previewData'
import type { PreviewTeam } from './previewData'

const agentNames: Record<string, string> = {
  'orbit-web': '웹 개발',
  'design-mate': '디자인 검토',
  'api-pilot': '서버 개발',
  'cloud-kit': '인프라 관리',
  'test-buddy': '품질 검토',
  'flow-assist': '화면 설계',
  'data-lens': '데이터 분석',
  'release-mate': '배포 관리',
}

const projectNames: Record<string, string> = {
  'DevLink Web': '서비스 웹',
  'Design System': '디자인 시스템',
  'DevLink API': '서비스 서버',
  Infrastructure: '인프라',
  Analytics: '데이터 분석',
}

export const immersivePreviewTeams: PreviewTeam[] = previewTeams.map((team) => ({
  ...team,
  name: team.id === 'orbit' ? '서비스 개발팀' : '플랫폼팀',
  inviteCode: team.id === 'orbit' ? 'DEVLINK-7K2M' : 'DEVLINK-4N8Q',
  members: team.members.map((member) => ({
    ...member,
    agents: member.agents.map((agent) => ({
      ...agent,
      name: agentNames[agent.id] ?? agent.name,
      project: projectNames[agent.project] ?? agent.project,
    })),
  })),
}))
