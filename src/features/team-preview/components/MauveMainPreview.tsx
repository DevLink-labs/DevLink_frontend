import { useRef, useState } from 'react'
import { Icon, Modal } from '../../../components/ui'
import { copyText } from '../../../utils'
import { previewTeams } from '../data/previewData'
import type { PreviewAgent } from '../data/previewData'
import '../styles/MauveMainPreview.css'

type MauveAgent = PreviewAgent & { owner: string; initials: string }
type MauveDialog = 'guide' | 'invite' | MauveAgent | null

const palette = ['#FAF8F6', '#302B36', '#755C7F', '#D8B5B0', '#EEE6EF']

export default function MauveMainPreview() {
  const [teamId, setTeamId] = useState(previewTeams[0].id)
  const [query, setQuery] = useState('')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [section, setSection] = useState<'overview' | 'teams' | 'agents'>('overview')
  const [dialog, setDialog] = useState<MauveDialog>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const overview = useRef<HTMLElement>(null)
  const teamsSection = useRef<HTMLElement>(null)
  const agentsSection = useRef<HTMLElement>(null)
  const team = previewTeams.find((item) => item.id === teamId) ?? previewTeams[0]
  const agents: MauveAgent[] = team.members.flatMap((member) => member.agents.map((agent) => ({ ...agent, owner: member.name, initials: member.initials })))
  const onlineCount = agents.filter((agent) => agent.online).length
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleAgents = agents.filter((agent) => (!onlineOnly || agent.online) && `${agent.name} ${agent.project} ${agent.owner} ${agent.tool}`.toLocaleLowerCase().includes(normalizedQuery))

  function navigate(next: typeof section) {
    setSection(next)
    const target = next === 'overview' ? overview.current : next === 'teams' ? teamsSection.current : agentsSection.current
    target?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  function selectTeam(id: string) {
    setTeamId(id)
    setQuery('')
    setOnlineOnly(false)
  }

  function openInvite() {
    setCopied(false)
    setCopyError(false)
    setDialog('invite')
  }

  async function copyInvite() {
    try {
      await copyText(team.inviteCode)
      setCopied(true)
      setCopyError(false)
    } catch {
      setCopyError(true)
    }
  }

  return <div className="mauve-main-preview">
    <aside className="mvp-rail" aria-label="Mauve Studio 메뉴">
      <a className="mvp-logo" href="/" aria-label="DevLink 서비스 홈">d<span /></a>
      <div className="mvp-rail-divider" />
      <nav aria-label="워크스페이스 메뉴">
        <button type="button" className={section === 'overview' ? 'is-active' : ''} aria-label="워크스페이스" aria-pressed={section === 'overview'} onClick={() => navigate('overview')}><Icon name="grid" size={20} /><span>홈</span></button>
        <button type="button" className={section === 'teams' ? 'is-active' : ''} aria-label="내 팀" aria-pressed={section === 'teams'} onClick={() => navigate('teams')}><Icon name="team" size={20} /><span>팀</span></button>
        <button type="button" className={section === 'agents' ? 'is-active' : ''} aria-label="에이전트" aria-pressed={section === 'agents'} onClick={() => navigate('agents')}><Icon name="agent" size={20} /><span>Agent</span></button>
      </nav>
      <div className="mvp-rail-bottom"><button type="button" aria-label="시작 가이드" onClick={() => setDialog('guide')}><Icon name="book" size={19} /></button><span className="mvp-rail-avatar" title="최보경">보경</span></div>
    </aside>

    <div className="mvp-shell">
      <header className="mvp-topbar"><a href="/" className="mvp-wordmark">DevLink<span>.</span></a><span className="mvp-topbar-divider" /><span>나의 워크스페이스</span><div className="mvp-topbar-right"><span className="mvp-topbar-note"><i />A space to build, together.</span><button type="button" onClick={() => setDialog('guide')}><Icon name="book" size={15} />시작 가이드</button></div></header>

      <main className="mvp-main" ref={overview}>
        <section className="mvp-heading">
          <div><span className="mvp-eyebrow">WORK, IN GOOD COMPANY</span><h1>작은 팀의<br />큰 가능성을 연결해요<span>.</span></h1><p>사람과 Agent가 모여, 아이디어를 현실로 만드는 곳.</p></div>
          <div className="mvp-greeting"><span className="mvp-greeting-mark" aria-hidden="true">✳</span><span>반가워요, <strong>보경님.</strong><small>오늘도 좋은 동료와 함께하세요.</small></span></div>
        </section>

        <div className="mvp-summary" aria-label="워크스페이스 요약"><div><span className="mvp-summary-icon"><Icon name="team" size={19} /></span><span>참여 중인 팀<strong>{String(previewTeams.length).padStart(2, '0')}<small>개</small></strong></span></div><div><span className="mvp-summary-icon"><Icon name="agent" size={19} /></span><span>선택한 팀의 Agent<strong>{String(agents.length).padStart(2, '0')}<small>개</small></strong></span></div><div><span className="mvp-summary-icon"><Icon name="shield" size={19} /></span><span>연결된 Agent<strong>{String(onlineCount).padStart(2, '0')}<small>/ {agents.length}개</small></strong></span><span className="mvp-summary-live"><i />ONLINE</span></div></div>

        <section className="mvp-teams" ref={teamsSection} aria-labelledby="mvp-teams-title">
          <div className="mvp-section-heading"><div><span className="mvp-section-number">01</span><h2 id="mvp-teams-title">우리의 팀 공간</h2><span className="mvp-count">{previewTeams.length}</span></div><span>함께할 공간을 선택하세요.</span></div>
          <div className="mvp-team-grid">{previewTeams.map((item, index) => <button type="button" key={item.id} className={`mvp-team-card ${team.id === item.id ? 'is-selected' : ''}`} aria-pressed={team.id === item.id} onClick={() => selectTeam(item.id)}><span className="mvp-team-card-main"><span className={`mvp-team-emblem mvp-team-emblem-${index}`}>{index === 0 ? 'O' : 'P'}<i /></span><span><span className="mvp-team-caption">TEAM WORKSPACE</span><strong>{item.name}</strong><span className="mvp-team-description">{item.description}</span></span><span className="mvp-team-check"><Icon name={team.id === item.id ? 'check' : 'arrow'} size={17} /></span></span><span className="mvp-team-card-bottom"><span className="mvp-avatar-stack">{item.members.slice(0, 4).map((member) => <span key={member.id} title={member.name}>{member.initials.slice(0, 1)}</span>)}</span><span>팀원 {item.members.length}<i />Agent {item.members.flatMap((member) => member.agents).length}</span><span className="mvp-team-selected-label">{team.id === item.id ? '현재 선택한 공간' : '공간 선택하기'}</span></span></button>)}</div>
        </section>

        <div className="mvp-workspace-grid">
          <section className="mvp-agents" ref={agentsSection} aria-labelledby="mvp-agents-title">
            <div className="mvp-section-heading"><div><span className="mvp-section-number">02</span><h2 id="mvp-agents-title">팀의 개발 파트너</h2></div><span>{team.name}</span></div>
            <div className="mvp-agent-panel"><div className="mvp-agent-toolbar"><div className="mvp-filter" role="group" aria-label="Agent 연결 상태 필터"><button type="button" className={!onlineOnly ? 'is-active' : ''} aria-pressed={!onlineOnly} onClick={() => setOnlineOnly(false)}>전체<span>{agents.length}</span></button><button type="button" className={onlineOnly ? 'is-active' : ''} aria-pressed={onlineOnly} onClick={() => setOnlineOnly(true)}><i />온라인<span>{onlineCount}</span></button></div><label className="mvp-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></svg><span className="mvp-sr-only">Agent, 프로젝트, 팀원 검색</span><input type="search" placeholder="Agent 검색" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div><div className="mvp-agent-column-head" aria-hidden="true"><span>AGENT / PROJECT</span><span>TEAMMATE</span><span>STATUS</span><span /></div><div className="mvp-agent-list">{visibleAgents.map((agent) => <button type="button" className="mvp-agent-row" key={agent.id} onClick={() => setDialog(agent)} aria-label={`${agent.name} 상세 보기`}><span className={`mvp-agent-symbol ${agent.tool === 'Claude Code' ? 'is-claude' : ''}`}>{agent.tool === 'Codex' ? <Icon name="agent" size={20} /> : '✳'}</span><span className="mvp-agent-identity"><strong>{agent.name}</strong><small>{agent.project}<i />{agent.tool}</small></span><span className="mvp-agent-owner"><span>{agent.initials.slice(0, 1)}</span>{agent.owner}</span><span className={`mvp-status ${agent.online ? 'is-online' : ''}`}><i />{agent.online ? '온라인' : '오프라인'}</span><Icon name="chevron" size={14} /></button>)}</div>{visibleAgents.length === 0 && <div className="mvp-empty"><Icon name="agent" size={26} /><strong>조건에 맞는 Agent가 없어요.</strong><p>다른 검색어나 연결 상태를 선택해보세요.</p><button type="button" onClick={() => { setQuery(''); setOnlineOnly(false) }}>검색 초기화<Icon name="refresh" size={14} /></button></div>}<div className="mvp-agent-foot"><span role="status">{agents.length}개 중 {visibleAgents.length}개 표시</span><span><Icon name="shield" size={12} />팀 안에서 안전하게 연결돼요.</span></div></div>
          </section>

          <aside className="mvp-context"><section className="mvp-team-context"><div className="mvp-context-caption"><span>IN THIS SPACE</span><span>#{team.id === 'orbit' ? '001' : '002'}</span></div><h2>{team.name}</h2><p>{team.description}</p><div className="mvp-connection-art" aria-hidden="true"><span><Icon name="team" size={25} /></span><i /><span>+</span><i /><span><Icon name="agent" size={27} /></span></div><dl><div><dt>함께하는 사람</dt><dd>{team.members.length}명</dd></div><div><dt>팀을 시작한 날</dt><dd>{team.createdAt}</dd></div></dl><button type="button" className="mvp-invite" onClick={openInvite}>함께할 동료 초대하기<Icon name="plus" size={16} /></button></section><section className="mvp-members"><div><h3>좋은 동료들</h3><span>{team.members.length}</span></div>{team.members.slice(0, 4).map((member, index) => <div className="mvp-member" key={member.id}><span className={`mvp-member-avatar mvp-member-avatar-${index % 2}`}>{member.initials}</span><span><strong>{member.name}{member.id === 'jiwoo' && <small>나</small>}</strong><small>{member.role === 'OWNER' ? 'Team owner' : 'Team member'}</small></span><span>{member.agents.length}<small>Agent</small></span></div>)}<span className="mvp-members-note">서로 다른 가능성이 모이는 곳.</span></section></aside>
        </div>

        <footer className="mvp-footer"><div><strong>DevLink<span>.</span></strong><span>Mauve Studio · 목업 데이터로 구성된 메인 페이지 시안</span></div><div className="mvp-palette" aria-label="Mauve Studio 색상 팔레트">{palette.map((color) => <span key={color}><i style={{ background: color }} /><span>{color}</span></span>)}</div></footer>
      </main>
    </div>

    {dialog && <Modal title={dialog === 'guide' ? '함께 만드는 첫 번째 연결' : dialog === 'invite' ? '새로운 동료를 기다려요' : dialog.name} description={typeof dialog === 'object' ? `${dialog.tool} · ${team.name}` : team.name} onClose={() => setDialog(null)}>{dialog === 'guide' ? <><ol className="mvp-guide"><li><span>01</span><div><strong>팀 공간 선택하기</strong><p>팀 카드를 선택하면 함께하는 사람과 Agent가 표시돼요.</p></div></li><li><span>02</span><div><strong>개발 파트너 알아보기</strong><p>Agent를 선택해 담당 프로젝트와 역할을 확인하세요.</p></div></li><li><span>03</span><div><strong>새로운 동료 초대하기</strong><p>우리의 공간에 함께할 동료를 초대할 수 있어요.</p></div></li></ol><button className="mvp-modal-button" type="button" onClick={() => setDialog(null)}>공간 둘러보기<Icon name="arrow" size={16} /></button></> : dialog === 'invite' ? <><div className="mvp-invite-ticket"><span>AN INVITATION TO BUILD TOGETHER</span><label htmlFor="mvp-invite-code">팀 초대 코드</label><input id="mvp-invite-code" value={team.inviteCode} readOnly onFocus={(event) => event.currentTarget.select()} /><p>디자인 미리보기용 코드입니다.</p></div><p className="mvp-copy-status" role="status">{copied ? '초대 코드를 복사했어요.' : copyError ? '위 코드를 선택해 직접 복사해주세요.' : '함께하고 싶은 동료에게 전달하세요.'}</p><button className="mvp-modal-button" type="button" onClick={() => { void copyInvite() }}><Icon name={copied ? 'check' : 'copy'} size={16} />{copied ? '복사 완료' : '초대 코드 복사'}</button></> : <><div className="mvp-modal-agent"><span><Icon name="agent" size={28} /></span><span className={`mvp-status ${dialog.online ? 'is-online' : ''}`}><i />{dialog.online ? '온라인' : '오프라인'}</span></div><p className="mvp-agent-description">{dialog.description}</p><dl className="mvp-agent-meta"><div><dt>담당 프로젝트</dt><dd>{dialog.project}</dd></div><div><dt>함께하는 팀원</dt><dd>{dialog.owner}</dd></div></dl><button type="button" className="mvp-modal-button" onClick={() => setDialog(null)}>확인했어요<Icon name="check" size={16} /></button></>}</Modal>}
  </div>
}
