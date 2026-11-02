import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui'
import { previewTeams } from './previewData'
import type { PreviewAgent, PreviewMember } from './previewData'
import './SlateMainPreview.css'
import './RoseBlancMainPreview.css'

type AgentEntry = PreviewAgent & { member: PreviewMember }
type StatusFilter = 'all' | 'online' | 'offline'

function SearchIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
}

function Status({ online }: { online: boolean }) {
  return <span className={`smp-status ${online ? 'is-online' : ''}`}><i />{online ? '온라인' : '오프라인'}</span>
}

export default function SlateMainPreview({ appearance = 'slate' }: { appearance?: 'slate' | 'rose-blanc' }) {
  const isRoseBlanc = appearance === 'rose-blanc'
  const palette = isRoseBlanc ? ['#FBEFEF', '#FFE2E2', '#F5CBCB', '#C5B3D3'] : ['#F8FAFC', '#D9EAFD', '#BCCCDC', '#9AA6B2']
  const [teamId, setTeamId] = useState(previewTeams[0].id)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [toolFilter, setToolFilter] = useState('all')
  const [selectedAgent, setSelectedAgent] = useState<AgentEntry | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<'overview' | 'agents'>('overview')
  const agentsSection = useRef<HTMLElement>(null)
  const overviewSection = useRef<HTMLElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const team = previewTeams.find((item) => item.id === teamId) ?? previewTeams[0]
  const agents: AgentEntry[] = team.members.flatMap((member) => member.agents.map((agent) => ({ ...agent, member })))
  const onlineCount = agents.filter((agent) => agent.online).length
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleAgents = agents.filter((agent) => (
    (!normalizedQuery || `${agent.name} ${agent.project} ${agent.member.name} ${agent.tool}`.toLocaleLowerCase().includes(normalizedQuery))
    && (statusFilter === 'all' || agent.online === (statusFilter === 'online'))
    && (toolFilter === 'all' || agent.tool === toolFilter)
  ))
  const modalOpen = selectedAgent !== null || guideOpen

  useEffect(() => {
    if (modalOpen) dialog.current?.showModal()
    return () => { if (dialog.current?.open) dialog.current.close() }
  }, [modalOpen])

  function selectTeam(nextTeamId: string) {
    setTeamId(nextTeamId)
    setQuery('')
    setStatusFilter('all')
    setToolFilter('all')
  }

  function navigate(section: 'overview' | 'agents') {
    setActiveSection(section)
    const target = section === 'agents' ? agentsSection.current : overviewSection.current
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
  }

  function closeModal() {
    setSelectedAgent(null)
    setGuideOpen(false)
  }

  return <div className={`slate-main-preview ${isRoseBlanc ? 'rose-blanc-main-preview' : ''}`}>
    <aside className="smp-sidebar" aria-label="워크스페이스 탐색">
      <a className="smp-brand" href="/" aria-label="DevLink 서비스 홈"><span className="smp-brand-symbol">D<span /></span>DevLink<span className="smp-brand-period">.</span></a>
      <div className="smp-workspace-picker"><span className="smp-workspace-icon"><Icon name="grid" size={17} /></span><div><strong>나의 워크스페이스</strong><span>Personal workspace</span></div><span className="smp-workspace-key">W</span></div>
      <p className="smp-nav-label">WORKSPACE</p>
      <nav className="smp-nav" aria-label="메인 메뉴">
        <button type="button" className={activeSection === 'overview' ? 'is-active' : ''} aria-current={activeSection === 'overview' ? 'page' : undefined} onClick={() => navigate('overview')}><Icon name="grid" size={18} />대시보드<span className="smp-nav-active-dot" /></button>
        <button type="button" className={activeSection === 'agents' ? 'is-active' : ''} aria-current={activeSection === 'agents' ? 'page' : undefined} onClick={() => navigate('agents')}><Icon name="agent" size={18} />팀 에이전트<span className="smp-nav-count">{agents.length}</span></button>
        <button type="button" onClick={() => setGuideOpen(true)}><Icon name="book" size={18} />연결 가이드<Icon name="arrow" size={14} /></button>
      </nav>
      <div className="smp-nav-rule" />
      <div className="smp-nav-label smp-teams-label">MY TEAMS<span>{previewTeams.length}</span></div>
      <div className="smp-team-nav">{previewTeams.map((item, index) => <button type="button" key={item.id} className={team.id === item.id ? 'is-selected' : ''} aria-pressed={team.id === item.id} onClick={() => selectTeam(item.id)}><span className={`smp-team-monogram smp-monogram-${index}`}>{item.name.slice(0, 1)}</span><span>{item.name}</span>{team.id === item.id && <Icon name="check" size={13} />}</button>)}</div>
      <div className="smp-sidebar-bottom"><div className="smp-sidebar-note"><span><Icon name="shield" size={19} /></span><strong>연결은 간결하게,<br />협업은 더 단단하게.</strong><p>팀과 에이전트를 위한<br />하나의 정돈된 공간.</p></div><div className="smp-profile"><span className="smp-person-avatar">보경</span><div><strong>최보경</strong><span>Personal account</span></div><span className="smp-profile-dot" /></div></div>
    </aside>

    <div className="smp-main-shell">
      <header className="smp-topbar"><div className="smp-breadcrumb"><span>Workspace</span><Icon name="chevron" size={12} /><strong>대시보드</strong></div><label className="smp-search"><SearchIcon /><span className="smp-sr-only">현재 팀의 에이전트, 프로젝트, 팀원 검색</span><input type="search" placeholder="에이전트, 프로젝트, 팀원 검색" value={query} onChange={(event) => setQuery(event.target.value)} /><span className="smp-search-hint">검색</span></label><span className="smp-topbar-avatar" aria-label="최보경 계정">BK</span></header>

      <main className="smp-main" ref={overviewSection}>
        <div className="smp-page-caption"><span><i />WORKSPACE OVERVIEW</span><span>매일의 개발을, 더 명료하게.</span></div>
        <section className="smp-welcome" aria-labelledby="smp-welcome-title"><div><span className="smp-welcome-kicker">A SPACE TO BUILD TOGETHER</span><h1 id="smp-welcome-title">반가워요, 보경님<span>.</span></h1><p>좋은 아이디어가 팀과 연결되는 곳.<br />오늘의 개발도 DevLink에서 시작해보세요.</p><button className="smp-primary-button" type="button" onClick={() => navigate('agents')}>팀 에이전트 살펴보기<Icon name="arrow" size={16} /></button></div><div className="smp-welcome-art" aria-hidden="true"><span className="smp-art-orbit smp-art-orbit-one" /><span className="smp-art-orbit smp-art-orbit-two" /><div className="smp-art-center"><Icon name="grid" size={38} /></div><span className="smp-art-node smp-art-node-one"><Icon name="agent" size={22} /></span><span className="smp-art-node smp-art-node-two"><Icon name="team" size={20} /></span><span className="smp-art-point smp-art-point-one" /><span className="smp-art-point smp-art-point-two" /><span className="smp-art-label"><i />EVERYTHING, CONNECTED.</span></div></section>

        <div className="smp-stats" aria-label="워크스페이스 통계">
          <div className="smp-stat"><div><span>참여 중인 팀</span><Icon name="team" size={18} /></div><strong>{String(previewTeams.length).padStart(2, '0')}<small>팀</small></strong><p>함께 만들어가는 워크스페이스<Icon name="arrow" size={13} /></p></div>
          <div className="smp-stat"><div><span>등록된 에이전트</span><Icon name="agent" size={18} /></div><strong>{String(agents.length).padStart(2, '0')}<small>개</small></strong><p>{isRoseBlanc ? '선택한 팀의 개발 파트너' : <><span className="smp-stat-team">{team.name}</span>에서 활동 중</>}</p></div>
          <div className="smp-stat smp-stat-online"><div><span>온라인 에이전트</span><span className="smp-live-label"><i />LIVE</span></div><strong>{String(onlineCount).padStart(2, '0')}<small>/ {agents.length}개</small></strong><p><span className="smp-stat-progress"><span style={{ width: `${onlineCount / Math.max(agents.length, 1) * 100}%` }} /></span><span>{Math.round(onlineCount / Math.max(agents.length, 1) * 100)}% 연결됨</span></p></div>
        </div>

        <section className="smp-teams-section" aria-labelledby="smp-teams-heading"><div className="smp-section-heading"><div><h2 id="smp-teams-heading">나의 팀<span>{previewTeams.length}</span></h2><p>함께하는 팀을 선택하고 작업을 이어가세요.</p></div><span className="smp-heading-note">YOUR COLLABORATIVE SPACES</span></div><div className="smp-team-cards">{previewTeams.map((item, index) => {
          const itemAgents = item.members.flatMap((member) => member.agents)
          return <button type="button" className={`smp-team-card ${team.id === item.id ? 'is-selected' : ''}`} key={item.id} aria-pressed={team.id === item.id} onClick={() => selectTeam(item.id)}><div className="smp-team-card-top"><span className={`smp-team-emblem smp-emblem-${index}`}><Icon name={index === 0 ? 'grid' : 'shield'} size={25} /></span><span className="smp-team-card-role">OWNER</span><span className="smp-team-selected">{team.id === item.id ? <><Icon name="check" size={12} />선택된 팀</> : <Icon name="arrow" size={15} />}</span></div><strong>{item.name}</strong><p>{item.description}</p><div className="smp-team-card-bottom"><div className="smp-avatar-stack">{item.members.slice(0, 4).map((member) => <span key={member.id} title={member.name}>{member.initials.slice(0, 1)}</span>)}{item.members.length > 4 && <span>+{item.members.length - 4}</span>}</div><span>팀원 {item.members.length}<i />에이전트 {itemAgents.length}</span></div></button>
        })}</div></section>

        <div className="smp-lower-grid">
          <section className="smp-agents-section" ref={agentsSection} aria-labelledby="smp-agents-heading"><div className="smp-section-heading"><div><h2 id="smp-agents-heading">팀 에이전트<span>{agents.length}</span></h2><p>{team.name}의 개발 파트너를 만나보세요.</p></div><span className="smp-list-mark"><Icon name="agent" size={15} /></span></div><div className="smp-agent-panel"><div className="smp-agent-toolbar"><div className="smp-filters" role="group" aria-label="연결 상태 필터">{([{ id: 'all', label: '전체', count: agents.length }, { id: 'online', label: '온라인', count: onlineCount }, { id: 'offline', label: '오프라인', count: agents.length - onlineCount }] as const).map((filter) => <button key={filter.id} type="button" className={statusFilter === filter.id ? 'is-active' : ''} aria-pressed={statusFilter === filter.id} onClick={() => setStatusFilter(filter.id)}>{filter.label}<span>{filter.count}</span></button>)}</div><label className="smp-tool-filter"><span className="smp-sr-only">에이전트 도구 필터</span><select value={toolFilter} onChange={(event) => setToolFilter(event.target.value)}><option value="all">모든 도구</option><option value="Codex">Codex</option><option value="Claude Code">Claude Code</option></select><Icon name="chevron" size={11} /></label></div><div className="smp-table-wrap"><table className="smp-agent-table"><thead><tr><th scope="col">에이전트 / 프로젝트</th><th scope="col">담당 팀원</th><th scope="col">연결 상태</th><th scope="col"><span className="smp-sr-only">상세 보기</span></th></tr></thead><tbody>{visibleAgents.map((agent) => <tr key={agent.id}><td><div className="smp-agent-identity"><span className={`smp-agent-mark ${agent.tool === 'Codex' ? 'is-codex' : ''}`}>{agent.tool === 'Codex' ? <Icon name="agent" size={19} /> : <span aria-hidden="true">✳</span>}</span><div><button type="button" className="smp-agent-name" onClick={() => setSelectedAgent(agent)}>{agent.name}</button><span>{agent.project}<i />{agent.tool}</span></div></div></td><td><span className="smp-table-member"><span>{agent.member.initials.slice(0, 1)}</span>{agent.member.name}</span></td><td><Status online={agent.online} /></td><td><button className="smp-row-detail" type="button" aria-label={`${agent.name} 상세 보기`} onClick={() => setSelectedAgent(agent)}><Icon name="chevron" size={16} /></button></td></tr>)}</tbody></table>{visibleAgents.length === 0 && <div className="smp-empty"><SearchIcon /><strong>조건에 맞는 에이전트가 없어요.</strong><p>다른 검색어나 연결 상태를 선택해보세요.</p><button type="button" onClick={() => { setQuery(''); setStatusFilter('all'); setToolFilter('all') }}>필터 초기화<Icon name="refresh" size={13} /></button></div>}</div><div className="smp-table-footer"><span role="status">전체 {agents.length}개 중 {visibleAgents.length}개 표시{query.trim() ? ` · “${query.trim()}” 검색 결과` : ''}</span><span>TEAM AGENTS</span></div></div></section>

          <aside className="smp-insights"><section className="smp-team-summary"><div className="smp-aside-caption">CURRENT SPACE<Icon name="grid" size={15} /></div><h3>{team.name}</h3><p>사람과 에이전트가 함께<br />하나의 흐름을 만들어갑니다.</p><div className="smp-summary-diagram" aria-hidden="true"><span className="smp-diagram-person"><Icon name="team" size={22} /></span><span className="smp-diagram-link"><i /><i /><i /></span><span className="smp-diagram-agent"><Icon name="agent" size={24} /></span></div><dl><div><dt>팀원</dt><dd>{team.members.length}명</dd></div><div><dt>온라인 에이전트</dt><dd>{onlineCount}개</dd></div><div><dt>팀 생성일</dt><dd>{team.createdAt}</dd></div></dl><div className="smp-summary-foot"><Icon name="shield" size={14} />우리 팀 안에서 안전하게</div></section><section className="smp-guide-card"><span><Icon name="book" size={18} />GETTING STARTED</span><h3>첫 연결도 어렵지 않아요.</h3><p>팀에 참여하고 에이전트를 연결하는<br />방법을 차근차근 알아보세요.</p><button type="button" onClick={() => setGuideOpen(true)}>연결 가이드 보기<Icon name="arrow" size={15} /></button></section></aside>
        </div>

        <footer className="smp-footer"><span><strong>DevLink</strong><span>더 나은 연결, 더 나은 개발.</span></span><p><i />{isRoseBlanc ? 'Rose Blanc · ' : ''}목업 데이터로 구성된 메인 페이지 시안입니다.</p><div className="smp-palette" aria-label={isRoseBlanc ? '로즈 라벤더 색상 팔레트' : '블루 슬레이트 색상 팔레트'}>{palette.map((color) => <i key={color} title={color} />)}</div></footer>
      </main>
    </div>

    {modalOpen && <dialog className="smp-dialog" ref={dialog} aria-labelledby="smp-dialog-title" onCancel={(event) => { event.preventDefault(); closeModal() }} onClick={(event) => { if (event.target === event.currentTarget) closeModal() }}><div className="smp-dialog-content"><div className="smp-dialog-top"><span>{selectedAgent ? 'AGENT DETAILS' : 'CONNECTION GUIDE'}</span><button type="button" className="smp-dialog-close" onClick={closeModal} aria-label="상세 창 닫기"><Icon name="close" size={19} /></button></div>{selectedAgent ? <><span className="smp-dialog-agent-icon"><Icon name="agent" size={30} /></span><h2 id="smp-dialog-title">{selectedAgent.name}</h2><Status online={selectedAgent.online} /><p className="smp-dialog-description">{selectedAgent.description}</p><dl className="smp-dialog-meta"><div><dt>도구</dt><dd>{selectedAgent.tool}</dd></div><div><dt>프로젝트</dt><dd>{selectedAgent.project}</dd></div><div><dt>담당 팀원</dt><dd>{selectedAgent.member.name}</dd></div><div><dt>소속 팀</dt><dd>{team.name}</dd></div></dl><p className="smp-dialog-note"><Icon name="eye" size={14} />디자인 확인을 위한 에이전트 예시입니다.</p></> : <><h2 id="smp-dialog-title">함께할 준비, 세 단계면 충분해요.</h2><p className="smp-dialog-description">팀과 에이전트를 연결하는 간단한 시작 가이드예요.</p><ol className="smp-guide-steps"><li><span>01</span><div><strong>함께할 팀 선택하기</strong><p>팀을 만들거나 초대 코드로 동료의 팀에 참여하세요.</p></div></li><li><span>02</span><div><strong>에이전트 등록하기</strong><p>도구와 프로젝트를 정하고 개발을 도울 에이전트를 등록하세요.</p></div></li><li><span>03</span><div><strong>연결 상태 확인하기</strong><p>에이전트를 연결한 뒤 워크스페이스에서 온라인 상태를 확인하세요.</p></div></li></ol><p className="smp-dialog-note"><Icon name="eye" size={14} />현재 화면은 실제 연결이 없는 디자인 미리보기입니다.</p></>}<button className="smp-primary-button smp-dialog-done" type="button" onClick={closeModal}>확인했어요<Icon name="check" size={15} /></button></div></dialog>}
  </div>
}
