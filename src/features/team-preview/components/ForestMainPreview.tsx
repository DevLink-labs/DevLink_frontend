import { useState } from 'react'
import { Icon, Modal } from '../../../components/ui'
import { previewTeams } from '../data/previewData'
import type { PreviewAgent } from '../data/previewData'
import '../styles/ForestMainPreview.css'

type ForestAgent = PreviewAgent & { owner: string; initials: string }
type ForestSection = 'overview' | 'agents' | 'members'

const forestPalette = ['#173D35', '#F6F7F3', '#ABC9B8', '#4D8772', '#253A32']

function AgentStatus({ online }: { online: boolean }) {
  return <span className={`fvp-status ${online ? 'is-online' : ''}`}><i />{online ? '온라인' : '오프라인'}</span>
}

export default function ForestMainPreview() {
  const [teamId, setTeamId] = useState(previewTeams[0].id)
  const [query, setQuery] = useState('')
  const [onlyOnline, setOnlyOnline] = useState(false)
  const [section, setSection] = useState<ForestSection>('overview')
  const [selectedAgent, setSelectedAgent] = useState<ForestAgent | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const team = previewTeams.find((item) => item.id === teamId) ?? previewTeams[0]
  const agents: ForestAgent[] = team.members.flatMap((member) => member.agents.map((agent) => ({ ...agent, owner: member.name, initials: member.initials })))
  const onlineCount = agents.filter((agent) => agent.online).length
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleAgents = agents.filter((agent) => (!onlyOnline || agent.online) && (!normalizedQuery || `${agent.name} ${agent.project} ${agent.tool} ${agent.owner}`.toLocaleLowerCase().includes(normalizedQuery)))

  function selectTeam(id: string) {
    setTeamId(id)
    setQuery('')
    setOnlyOnline(false)
    setSelectedAgent(null)
  }

  function navigate(nextSection: ForestSection) {
    setSection(nextSection)
    document.getElementById(`fvp-${nextSection}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  return <div className="forest-main-preview">
    <aside className="fvp-sidebar" aria-label="Forest Desk 워크스페이스 탐색">
      <a className="fvp-brand" href="/" aria-label="DevLink 홈"><span><Icon name="grid" size={22} /></span>DevLink<i /></a>
      <div className="fvp-workspace"><span className="fvp-workspace-symbol">W</span><div><strong>나의 워크스페이스</strong><small>Personal workspace</small></div><span className="fvp-workspace-number">01</span></div>
      <p className="fvp-nav-label">WORKSPACE</p>
      <nav className="fvp-nav" aria-label="워크스페이스 메뉴">
        <button type="button" className={section === 'overview' ? 'is-active' : ''} aria-current={section === 'overview' ? 'page' : undefined} onClick={() => navigate('overview')}><Icon name="grid" size={18} />오버뷰<i /></button>
        <button type="button" className={section === 'agents' ? 'is-active' : ''} aria-current={section === 'agents' ? 'page' : undefined} onClick={() => navigate('agents')}><Icon name="agent" size={18} />팀 에이전트<span>{agents.length}</span></button>
        <button type="button" className={section === 'members' ? 'is-active' : ''} aria-current={section === 'members' ? 'page' : undefined} onClick={() => navigate('members')}><Icon name="team" size={18} />함께하는 팀원<span>{team.members.length}</span></button>
      </nav>
      <div className="fvp-sidebar-rule" />
      <p className="fvp-nav-label fvp-team-label">MY TEAMS<span>{previewTeams.length}</span></p>
      <div className="fvp-team-nav">{previewTeams.map((item, index) => <button type="button" key={item.id} className={team.id === item.id ? 'is-selected' : ''} aria-pressed={team.id === item.id} onClick={() => selectTeam(item.id)}><span>{index === 0 ? 'O' : 'P'}</span>{item.name}{team.id === item.id && <Icon name="check" size={13} />}</button>)}</div>
      <div className="fvp-sidebar-bottom"><div className="fvp-sidebar-note"><span className="fvp-small-branch" aria-hidden="true"><i /><i /><i /></span><p>작은 연결이 모여,<br />단단한 팀이 됩니다.</p><button type="button" onClick={() => setGuideOpen(true)}>연결 가이드<Icon name="arrow" size={14} /></button></div><div className="fvp-profile"><span>보경</span><div><strong>최보경</strong><small>Personal account</small></div><i /></div></div>
    </aside>

    <div className="fvp-main-shell">
      <header className="fvp-topbar"><div><span>Workspace</span><Icon name="chevron" size={12} /><strong>오버뷰</strong></div><span className="fvp-edition">FOREST DESK <i /> 06</span><span className="fvp-topbar-avatar">BK</span></header>
      <main className="fvp-main" id="fvp-overview">
        <div className="fvp-page-heading"><div><span className="fvp-eyebrow">A GOOD PLACE TO BUILD</span><h1>좋은 흐름을, 함께.</h1><p>보경님, 오늘도 팀과 함께 한 걸음 나아가볼까요?</p></div><label className="fvp-team-picker"><span>현재 팀</span><select value={team.id} onChange={(event) => selectTeam(event.target.value)} aria-label="Forest Desk 현재 팀 선택">{previewTeams.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><Icon name="chevron" size={13} /></label></div>

        <div className="fvp-metrics" aria-label="워크스페이스 요약"><div><span>함께하는 팀</span><strong>{String(previewTeams.length).padStart(2, '0')}<small>spaces</small></strong></div><div><span>현재 팀의 에이전트</span><strong>{String(agents.length).padStart(2, '0')}<small>agents</small></strong></div><div><span><i className="fvp-live-dot" />온라인 에이전트</span><strong>{String(onlineCount).padStart(2, '0')}<small>connected</small></strong></div><span className="fvp-metrics-note"><Icon name="shield" size={17} />우리 팀의 연결을<br />한곳에서 살펴보세요.</span></div>

        <section className="fvp-team-board" aria-label={`${team.name} 연결 현황`}>
          <div className="fvp-team-identity"><span className="fvp-board-caption">YOUR CURRENT SPACE <span>EST. {team.createdAt}</span></span><div className="fvp-team-title"><span><Icon name="grid" size={25} /></span><div><h2>{team.name}</h2><p>{team.description}</p></div></div><div className="fvp-board-bottom"><span className="fvp-avatar-stack">{team.members.slice(0, 4).map((member) => <span key={member.id} title={member.name}>{member.initials.slice(0, 1)}</span>)}{team.members.length > 4 && <b>+{team.members.length - 4}</b>}</span><span>팀원 {team.members.length}명<small>각자의 가능성을 하나의 팀으로.</small></span><button type="button" onClick={() => navigate('members')} aria-label={`${team.name} 팀원 살펴보기`}><Icon name="arrow" size={17} /></button></div></div>
          <div className="fvp-connections"><div className="fvp-connections-heading"><span><i />TEAM CONNECTIONS</span><strong>{onlineCount}<small> / {agents.length} ONLINE</small></strong></div><div className="fvp-network"><svg viewBox="0 0 340 130" preserveAspectRatio="none" aria-hidden="true"><path d="M70 65H130Q145 65 145 45V28H205M145 65H205M145 65V102H205" /><circle cx="145" cy="65" r="3" /></svg><div className="fvp-network-team"><Icon name="team" size={25} /><span>TEAM</span></div><div className="fvp-network-agents">{agents.slice(0, 3).map((agent) => <button type="button" key={agent.id} onClick={() => setSelectedAgent(agent)}><span className="fvp-network-agent-mark"><Icon name="agent" size={15} /></span><span>{agent.name}</span><i className={agent.online ? 'is-online' : ''} /></button>)}</div></div><p>사람과 에이전트, 하나의 연결된 공간.</p></div>
        </section>

        <div className="fvp-content-grid">
          <section className="fvp-agents" id="fvp-agents" aria-labelledby="fvp-agents-title"><div className="fvp-section-heading"><div><span className="fvp-eyebrow">YOUR DEVELOPMENT PARTNERS</span><h2 id="fvp-agents-title">팀 에이전트<span>{agents.length}</span></h2></div><button type="button" className="fvp-guide-link" onClick={() => setGuideOpen(true)}><Icon name="book" size={15} />연결 가이드</button></div><div className="fvp-agent-controls"><label className="fvp-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg><span className="fvp-sr-only">Forest Desk 에이전트 검색</span><input type="search" placeholder="이름, 프로젝트, 팀원 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="fvp-filter" role="group" aria-label="Forest Desk 연결 상태 필터"><button type="button" className={!onlyOnline ? 'is-active' : ''} aria-pressed={!onlyOnline} onClick={() => setOnlyOnline(false)}>전체<span>{agents.length}</span></button><button type="button" className={onlyOnline ? 'is-active' : ''} aria-pressed={onlyOnline} onClick={() => setOnlyOnline(true)}><i />온라인<span>{onlineCount}</span></button></div></div><div className="fvp-agent-list">{visibleAgents.map((agent) => <button type="button" key={agent.id} className="fvp-agent-row" onClick={() => setSelectedAgent(agent)} aria-label={`${agent.name} 상세 보기`}><span className={`fvp-agent-mark ${agent.tool === 'Codex' ? 'is-codex' : ''}`}>{agent.tool === 'Codex' ? <Icon name="agent" size={20} /> : '✳'}</span><span className="fvp-agent-identity"><strong>{agent.name}</strong><small>{agent.tool}<i />{agent.owner}</small></span><span className="fvp-project-label">{agent.project}</span><AgentStatus online={agent.online} /><Icon name="chevron" size={14} /></button>)}{visibleAgents.length === 0 && <div className="fvp-empty"><Icon name="agent" size={25} /><strong>조건에 맞는 에이전트가 없어요.</strong><p>검색어나 연결 상태를 바꿔보세요.</p><button type="button" onClick={() => { setQuery(''); setOnlyOnline(false) }}>검색 초기화<Icon name="refresh" size={14} /></button></div>}</div><div className="fvp-list-footer"><span role="status">전체 {agents.length}개 중 {visibleAgents.length}개 표시</span><span><i />{team.name}</span></div></section>

          <aside className="fvp-members" id="fvp-members" aria-labelledby="fvp-members-title"><div className="fvp-section-heading"><div><span className="fvp-eyebrow">THE PEOPLE BEHIND IT</span><h2 id="fvp-members-title">함께하는 팀원<span>{team.members.length}</span></h2></div></div><div className="fvp-members-card"><div className="fvp-members-heading"><Icon name="team" size={17} /><span>같은 방향을 바라보는 동료들</span></div>{team.members.map((member, index) => <div className="fvp-member-row" key={member.id}><span className={`fvp-member-avatar fvp-member-avatar-${index % 3}`}>{member.initials.slice(0, 1)}</span><div><strong>{member.name}{member.id === 'jiwoo' && <small>나</small>}</strong><span>{member.role === 'OWNER' ? 'Team owner' : `${member.agents.length} Agent와 함께`}</span></div>{member.role === 'OWNER' ? <span className="fvp-owner-badge">OWNER</span> : <span className="fvp-member-agent-count">{String(member.agents.length).padStart(2, '0')}</span>}</div>)}<div className="fvp-members-footer"><span className="fvp-member-leaf" aria-hidden="true" /><p>함께할수록,<br />더 멀리 자라는 가능성.</p></div></div></aside>
        </div>

        <footer className="fvp-footer"><div><strong>DevLink<span>.</span></strong><p>Forest Desk · 목업 데이터로 구성된 메인 페이지 시안</p></div><div className="fvp-palette" aria-label="Forest Desk 색상 팔레트">{forestPalette.map((color) => <span key={color}><i style={{ background: color }} /><code>{color}</code></span>)}</div></footer>
      </main>
    </div>

    {selectedAgent && <Modal title={selectedAgent.name} description={`${selectedAgent.tool} · ${team.name}`} onClose={() => setSelectedAgent(null)}><div className="fvp-agent-detail"><span className="fvp-detail-mark"><Icon name="agent" size={28} /></span><AgentStatus online={selectedAgent.online} /><p>{selectedAgent.description}</p><dl><div><dt>프로젝트</dt><dd>{selectedAgent.project}</dd></div><div><dt>담당 팀원</dt><dd>{selectedAgent.owner}</dd></div><div><dt>소속 팀</dt><dd>{team.name}</dd></div></dl><span className="fvp-demo-note">디자인 확인을 위한 에이전트 예시입니다.</span></div><button type="button" className="fvp-modal-button" onClick={() => setSelectedAgent(null)}>확인했어요<Icon name="check" size={16} /></button></Modal>}
    {guideOpen && <Modal title="좋은 협업은 작은 연결부터." description="팀과 에이전트를 만나는 세 가지 단계" onClose={() => setGuideOpen(false)}><ol className="fvp-guide-steps"><li><span>01</span><div><strong>함께할 팀을 선택해요</strong><p>팀을 만들거나 초대 코드로 동료의 팀에 참여하세요.</p></div></li><li><span>02</span><div><strong>나의 에이전트를 등록해요</strong><p>도구와 담당 프로젝트를 정하고 팀의 에이전트로 등록하세요.</p></div></li><li><span>03</span><div><strong>연결 상태를 살펴봐요</strong><p>온라인 상태와 프로젝트를 한곳에서 확인할 수 있어요.</p></div></li></ol><p className="fvp-demo-note">현재 화면은 목업 데이터로 동작하는 디자인 미리보기입니다.</p><button type="button" className="fvp-modal-button" onClick={() => setGuideOpen(false)}>둘러볼게요<Icon name="arrow" size={16} /></button></Modal>}
  </div>
}
