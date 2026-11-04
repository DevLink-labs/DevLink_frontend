export interface PreviewAgent {
  id: string
  name: string
  tool: 'Codex' | 'Claude Code'
  project: string
  description: string
  online: boolean
}

export interface PreviewMember {
  id: string
  name: string
  initials: string
  nickname: string
  role: 'OWNER' | 'MEMBER'
  joinedAt: string
  color: string
  agents: PreviewAgent[]
}

export interface PreviewTeam {
  id: string
  name: string
  description: string
  createdAt: string
  inviteCode: string
  members: PreviewMember[]
}

const orbitMembers: PreviewMember[] = [
  {
    id: 'jiwoo', name: '최보경', initials: '보경', nickname: 'jiwoo', role: 'OWNER',
    joinedAt: '2026.09.14', color: 'sage',
    agents: [
      { id: 'orbit-web', name: 'Orbit Web', tool: 'Codex', project: 'DevLink Web', description: '팀의 웹 인터페이스와 디자인 시스템을 함께 만들어요.', online: true },
      { id: 'design-mate', name: 'Design Mate', tool: 'Claude Code', project: 'Design System', description: '컴포넌트의 일관성과 사용자 경험을 살펴봐요.', online: true },
    ],
  },
  {
    id: 'seojun', name: '이정민', initials: '정민', nickname: 'seojun', role: 'MEMBER',
    joinedAt: '2026.09.15', color: 'blue',
    agents: [{ id: 'api-pilot', name: 'API Pilot', tool: 'Claude Code', project: 'DevLink API', description: '안정적인 API와 서버의 연결을 도와요.', online: true }],
  },
  {
    id: 'haneul', name: '임효민', initials: '효민', nickname: 'haneul', role: 'MEMBER',
    joinedAt: '2026.09.16', color: 'peach',
    agents: [
      { id: 'cloud-kit', name: 'Cloud Kit', tool: 'Codex', project: 'Infrastructure', description: '배포 환경과 인프라 설정을 관리해요.', online: true },
      { id: 'test-buddy', name: 'Test Buddy', tool: 'Codex', project: 'DevLink API', description: '서비스의 품질과 예외 상황을 살펴봐요.', online: false },
    ],
  },
  {
    id: 'yuna', name: '최준혁', initials: '준혁', nickname: 'yuna', role: 'MEMBER',
    joinedAt: '2026.09.18', color: 'lavender',
    agents: [{ id: 'flow-assist', name: 'Flow Assist', tool: 'Claude Code', project: 'DevLink Web', description: '새로운 사용자 흐름을 프로토타입으로 구체화해요.', online: true }],
  },
  {
    id: 'doyoon', name: '박성수', initials: '성수', nickname: 'doyoon', role: 'MEMBER',
    joinedAt: '2026.09.21', color: 'sand',
    agents: [{ id: 'data-lens', name: 'Data Lens', tool: 'Codex', project: 'Analytics', description: '데이터의 구조를 정리하고 필요한 정보를 찾아요.', online: false }],
  },
  {
    id: 'minseo', name: '지상근', initials: '상근', nickname: 'minseo', role: 'MEMBER',
    joinedAt: '2026.09.23', color: 'mint',
    agents: [{ id: 'release-mate', name: 'Release Mate', tool: 'Claude Code', project: 'DevLink Web', description: '릴리스 준비와 변경 사항 정리를 함께해요.', online: true }],
  },
]

export const previewTeams: PreviewTeam[] = [
  { id: 'orbit', name: 'Orbit Studio', description: '작은 아이디어를 함께, 더 멀리.', createdAt: '2026.09.14', inviteCode: 'ORBIT-7K2M', members: orbitMembers },
  { id: 'platform', name: 'Platform Lab', description: '더 나은 개발 경험을 만드는 실험실.', createdAt: '2026.10.08', inviteCode: 'PLAB-4N8Q', members: orbitMembers.filter((member) => ['jiwoo', 'seojun', 'haneul', 'yuna'].includes(member.id)).map((member, index) => ({ ...member, joinedAt: `2026.10.${String(8 + index).padStart(2, '0')}`, agents: member.agents.slice(0, 1) })) },
]
