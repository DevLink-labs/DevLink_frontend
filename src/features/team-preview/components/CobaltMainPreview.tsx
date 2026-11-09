import BrandLogo from "@/components/common/BrandLogo";
import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon, Modal } from '../../../components/ui'
import { previewTeams } from '../data/previewData'
import type { PreviewAgent, PreviewMember } from '../data/previewData'
import '../styles/CobaltMainPreview.css'

type CobaltAgent = PreviewAgent & { member: PreviewMember }
type ConnectionFilter = 'all' | 'online' | 'offline'

function SearchMark() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
}

export default function CobaltMainPreview() {
  const [teamId, setTeamId] = useState(previewTeams[0].id)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<ConnectionFilter>('all')
  const [memberId, setMemberId] = useState<string | null>(null)
  const [selectedAgent, setSelectedAgent] = useState<CobaltAgent | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [section, setSection] = useState<'overview' | 'agents'>('overview')
  const overview = useRef<HTMLElement>(null)
  const agentSection = useRef<HTMLElement>(null)
  const team = previewTeams.find((item) => item.id === teamId) ?? previewTeams[0]
  const agents = team.members.flatMap((member) => member.agents.map((agent) => ({ ...agent, member })))
  const onlineCount = agents.filter((agent) => agent.online).length
  const selectedMember = team.members.find((member) => member.id === memberId)
  const searchTerm = query.trim().toLocaleLowerCase()
  const visibleAgents = agents.filter((agent) => (
    (!searchTerm || `${agent.name} ${agent.project} ${agent.tool} ${agent.member.name}`.toLocaleLowerCase().includes(searchTerm))
    && (status === 'all' || agent.online === (status === 'online'))
    && (!memberId || agent.member.id === memberId)
  ))
  const palette = ['#F5F7FC', '#1B2942', '#4566D5', '#E7EDFC', '#8D9BB6']

  function changeTeam(id: string) {
    setTeamId(id)
    setQuery('')
    setStatus('all')
    setMemberId(null)
    setSelectedAgent(null)
  }

  function navigate(next: 'overview' | 'agents') {
    setSection(next)
    const target = next === 'overview' ? overview.current : agentSection.current
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  function filterByMember(id: string) {
    setMemberId((previous) => previous === id ? null : id)
    navigate('agents')
  }

  return <div className="cobalt-main-preview">
    <aside className="cvp-sidebar" aria-label="코발트 워크스페이스 탐색">
      <a className="cvp-brand" href="/" aria-label="DevLink 홈"><BrandLogo /></a>
      <div className="cvp-workspace"><span><Icon name="grid" size={17} /></span><div><strong>보경님의 공간</strong><small>Personal workspace</small></div><span className="cvp-workspace-badge">W</span></div>
      <p className="cvp-nav-label">WORKSPACE</p>
      <nav className="cvp-navigation" aria-label="워크스페이스 메뉴">
        <button type="button" className={section === 'overview' ? 'is-active' : ''} onClick={() => navigate('overview')} aria-current={section === 'overview' ? 'page' : undefined}><Icon name="grid" size={18} />오버뷰<span className="cvp-active-marker" /></button>
        <button type="button" className={section === 'agents' ? 'is-active' : ''} onClick={() => navigate('agents')} aria-current={section === 'agents' ? 'page' : undefined}><Icon name="agent" size={18} />팀 에이전트<span className="cvp-nav-count">{agents.length}</span></button>
        <button type="button" onClick={() => setGuideOpen(true)}><Icon name="book" size={18} />연결 가이드<Icon name="arrow" size={14} /></button>
      </nav>
      <div className="cvp-sidebar-line" />
      <div className="cvp-nav-label cvp-teams-label">YOUR TEAMS<span>{previewTeams.length}</span></div>
      <div className="cvp-sidebar-teams">{previewTeams.map((item) => <button key={item.id} type="button" className={team.id === item.id ? 'is-selected' : ''} aria-pressed={team.id === item.id} onClick={() => changeTeam(item.id)}><span>{item.name.slice(0, 1)}</span>{item.name}{team.id === item.id && <Icon name="check" size={13} />}</button>)}</div>
      <div className="cvp-sidebar-bottom"><div className="cvp-sidebar-note"><Icon name="shield" size={20} /><strong>연결은 하나로.<br />가능성은 더 넓게.</strong><p>사람과 에이전트가 함께하는<br />팀의 개발 공간.</p></div><div className="cvp-profile"><span>보경</span><div><strong>최보경</strong><small>Personal account</small></div><i /></div></div>
    </aside>

    <div className="cvp-main-shell">
      <header className="cvp-topbar"><div className="cvp-breadcrumb"><span>Workspace</span><Icon name="chevron" size={12} /><strong>Overview</strong></div><label className="cvp-search"><SearchMark /><span className="cvp-sr-only">에이전트, 프로젝트, 팀원 검색</span><input type="search" placeholder="에이전트, 프로젝트, 팀원 검색" value={query} onChange={(event) => { setQuery(event.target.value); setSection('agents') }} /><span>찾기</span></label><span className="cvp-topbar-avatar" aria-label="최보경 프로필">BK</span></header>
      <main className="cvp-main" ref={overview}>
        <div className="cvp-page-heading"><div><span className="cvp-eyebrow">MAKE ROOM FOR GREAT WORK</span><h1>함께 만드는 다음을 위해<span>.</span></h1><p>좋은 동료와 든든한 에이전트, 팀의 연결을 한곳에서 확인하세요.</p></div><button className="cvp-guide-button" type="button" onClick={() => setGuideOpen(true)}><Icon name="book" size={16} />시작 가이드<Icon name="arrow" size={14} /></button></div>

        <div className="cvp-workspace-stats" aria-label="워크스페이스 요약"><div><span className="cvp-stat-symbol"><Icon name="team" size={18} /></span><span>참여 중인 팀<strong>{String(previewTeams.length).padStart(2, '0')}<small>팀</small></strong></span></div><div><span className="cvp-stat-symbol"><Icon name="agent" size={18} /></span><span>현재 팀 에이전트<strong>{String(agents.length).padStart(2, '0')}<small>개</small></strong></span></div><div><span className="cvp-stat-symbol cvp-stat-symbol-live"><Icon name="shield" size={18} /></span><span>연결된 에이전트<strong>{String(onlineCount).padStart(2, '0')}<small>/ {agents.length}개</small></strong></span><span className="cvp-stat-live"><i />ONLINE</span></div></div>

        <div className="cvp-content-grid">
          <div className="cvp-workbench">
            <section className="cvp-team-workbench" aria-labelledby="cvp-team-heading">
              <div className="cvp-section-heading"><div><span className="cvp-eyebrow">YOUR TEAM, CONNECTED</span><h2 id="cvp-team-heading">나의 팀 공간</h2></div><span className="cvp-section-index">01 / WORKSPACE</span></div>
              <div className="cvp-team-tabs" role="group" aria-label="현재 팀 선택">{previewTeams.map((item) => <button key={item.id} type="button" className={team.id === item.id ? 'is-selected' : ''} aria-pressed={team.id === item.id} onClick={() => changeTeam(item.id)}><span>{item.name.slice(0, 1)}</span><strong>{item.name}</strong><small>{item.members.length}명</small>{team.id === item.id && <Icon name="check" size={13} />}</button>)}</div>
              <div className="cvp-team-banner"><div><span className="cvp-banner-kicker">CURRENT TEAM <i />#{team.id === 'orbit' ? '001' : '002'}</span><h3>{team.name}</h3><p>{team.description}</p><span className="cvp-banner-meta"><Icon name="team" size={14} />팀원 {team.members.length}명<span />에이전트 {agents.length}개</span></div><div className="cvp-connection-graphic" aria-label={`에이전트 ${agents.length}개 중 ${onlineCount}개 연결`}><div style={{ '--cvp-connected': `${onlineCount / Math.max(agents.length, 1) * 100}%` } as CSSProperties}><Icon name="agent" size={22} /><strong>{onlineCount}<small>/{agents.length}</small></strong></div><span>AGENTS CONNECTED</span></div></div>
              <div className="cvp-connection-strip"><span><i />팀 연결 현황</span><div aria-hidden="true">{agents.map((agent) => <i key={agent.id} className={agent.online ? 'is-online' : ''} />)}</div><strong>{onlineCount}개 온라인 <span>· {agents.length - onlineCount}개 오프라인</span></strong></div>
            </section>

            <section className="cvp-agents-section" ref={agentSection} aria-labelledby="cvp-agents-heading"><div className="cvp-section-heading"><div><h2 id="cvp-agents-heading">팀 에이전트<span>{agents.length}</span></h2><p>팀의 아이디어를 함께 구현하는 개발 파트너.</p></div><span className="cvp-section-index">02 / AGENTS</span></div><div className="cvp-agent-panel"><div className="cvp-agent-toolbar"><div className="cvp-status-tabs" role="group" aria-label="에이전트 연결 상태">{([{ id: 'all', label: '전체' }, { id: 'online', label: '온라인' }, { id: 'offline', label: '오프라인' }] as const).map((filter) => <button key={filter.id} type="button" className={status === filter.id ? 'is-active' : ''} onClick={() => setStatus(filter.id)} aria-pressed={status === filter.id}>{filter.label}</button>)}</div>{selectedMember ? <button className="cvp-member-filter" type="button" onClick={() => setMemberId(null)}>{selectedMember.name}<Icon name="close" size={12} /></button> : <span className="cvp-agent-result">{visibleAgents.length} agents</span>}</div><div className="cvp-agent-columns" aria-hidden="true"><span>에이전트 / 프로젝트</span><span>도구</span><span>담당 팀원</span><span>상태</span></div><div className="cvp-agent-list">{visibleAgents.length > 0 ? visibleAgents.map((agent) => <button className="cvp-agent-row" type="button" key={agent.id} onClick={() => setSelectedAgent(agent)} aria-label={`${agent.name} 상세 보기`}><span className={`cvp-agent-avatar ${agent.tool === 'Codex' ? 'is-codex' : ''}`}>{agent.tool === 'Codex' ? <Icon name="agent" size={19} /> : <span>✳</span>}</span><span className="cvp-agent-name"><strong>{agent.name}</strong><small>{agent.project}</small></span><span className="cvp-tool-name">{agent.tool}</span><span className="cvp-agent-owner">{agent.member.name}</span><span className={`cvp-agent-status ${agent.online ? 'is-online' : ''}`}><i />{agent.online ? '온라인' : '오프라인'}</span><Icon name="chevron" size={14} /></button>) : <div className="cvp-empty"><SearchMark /><strong>조건에 맞는 에이전트가 없어요.</strong><p>다른 검색어나 필터를 선택해보세요.</p><button type="button" onClick={() => { setQuery(''); setStatus('all'); setMemberId(null) }}>필터 초기화<Icon name="refresh" size={13} /></button></div>}</div><div className="cvp-agent-footnote" role="status"><span>전체 {agents.length}개 중 {visibleAgents.length}개 표시{searchTerm ? ` · “${query.trim()}” 검색 결과` : ''}</span><Icon name="shield" size={13} /></div></div></section>
          </div>

          <aside className="cvp-context-column"><section className="cvp-members-card" aria-labelledby="cvp-members-heading"><div className="cvp-context-heading"><h2 id="cvp-members-heading">함께하는 사람들</h2><span>{team.members.length}</span></div><p>이름을 선택하면 담당 에이전트를 볼 수 있어요.</p><div className="cvp-members-list">{team.members.map((member, index) => <button key={member.id} type="button" className={memberId === member.id ? 'is-selected' : ''} aria-pressed={memberId === member.id} onClick={() => filterByMember(member.id)}><span className={`cvp-member-avatar cvp-member-avatar-${index % 3}`}>{member.initials.slice(0, 1)}</span><span><strong>{member.name}{member.id === 'jiwoo' && <small>나</small>}</strong><small>{member.role === 'OWNER' ? 'Team owner' : 'Team member'}</small></span><span className="cvp-member-agent-count">{member.agents.length}<Icon name={memberId === member.id ? 'check' : 'agent'} size={13} /></span></button>)}</div><div className="cvp-members-note"><Icon name="team" size={14} />좋은 연결이, 더 나은 개발로.</div></section><section className="cvp-tools-card"><span className="cvp-eyebrow">TOOLS IN YOUR SPACE</span><h2>각자의 도구로,<br />하나의 팀처럼.</h2><div>{(['Codex', 'Claude Code'] as const).map((tool) => <span key={tool}><i>{tool === 'Codex' ? <Icon name="agent" size={16} /> : '✳'}</i><strong>{tool}</strong><span>{agents.filter((agent) => agent.tool === tool).length}개</span></span>)}</div><p>도구가 달라도 팀의 공간은 함께.</p></section><div className="cvp-team-created"><span>TEAM CREATED</span><strong>{team.createdAt}</strong><Icon name="grid" size={30} /></div></aside>
        </div>

        <footer className="cvp-footer"><div><BrandLogo variant="wordmark" className="cvp-footer-logo" /><span>Cobalt Workspace · 목업 데이터로 구성된 시안입니다.</span></div><div className="cvp-palette" aria-label="코발트 워크스페이스 색상 팔레트">{palette.map((color) => <span key={color}><i style={{ background: color }} /><small>{color}</small></span>)}</div></footer>
      </main>
    </div>

    {selectedAgent && <Modal title={selectedAgent.name} description={`${team.name} · ${selectedAgent.tool}`} onClose={() => setSelectedAgent(null)}><div className="cvp-detail-head"><span className="cvp-detail-icon"><Icon name="agent" size={29} /></span><span className={`cvp-agent-status ${selectedAgent.online ? 'is-online' : ''}`}><i />{selectedAgent.online ? '온라인' : '오프라인'}</span></div><p className="cvp-detail-description">{selectedAgent.description}</p><dl className="cvp-detail-meta"><div><dt>담당 프로젝트</dt><dd>{selectedAgent.project}</dd></div><div><dt>담당 팀원</dt><dd>{selectedAgent.member.name}</dd></div><div><dt>사용 도구</dt><dd>{selectedAgent.tool}</dd></div></dl><p className="cvp-modal-note">디자인 확인을 위한 에이전트 예시입니다.</p><button type="button" className="cvp-primary" onClick={() => setSelectedAgent(null)}>확인<Icon name="check" size={16} /></button></Modal>}
    {guideOpen && <Modal title="우리 팀의 첫 연결" description="팀과 에이전트를 함께 시작하는 방법" onClose={() => setGuideOpen(false)}><ol className="cvp-guide-steps"><li><span>01</span><div><strong>함께할 팀 선택하기</strong><p>나의 팀 공간에서 함께하는 팀을 선택하세요.</p></div></li><li><span>02</span><div><strong>개발 파트너 살펴보기</strong><p>에이전트의 도구와 담당 프로젝트를 확인하세요.</p></div></li><li><span>03</span><div><strong>팀원의 연결 확인하기</strong><p>팀원을 선택하면 담당 에이전트만 모아 볼 수 있어요.</p></div></li></ol><p className="cvp-modal-note">현재 화면은 실제 연결 없이 구성된 디자인 미리보기입니다.</p><button type="button" className="cvp-primary" onClick={() => setGuideOpen(false)}>둘러볼게요<Icon name="arrow" size={16} /></button></Modal>}
  </div>
}
