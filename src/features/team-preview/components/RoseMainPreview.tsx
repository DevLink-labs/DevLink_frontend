import BrandLogo from "@/components/common/BrandLogo";
import { useState } from 'react'
import { Icon, Modal } from '../../../components/ui'
import { copyText } from '../../../utils'
import { previewTeams } from '../data/previewData'
import '../styles/RoseMainPreview.css'

type RoseSection = 'overview' | 'teams' | 'agents'

export default function RoseMainPreview() {
  const [teamId, setTeamId] = useState(previewTeams[0].id)
  const [section, setSection] = useState<RoseSection>('overview')
  const [agentId, setAgentId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<'invite' | 'guide' | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const team = previewTeams.find((item) => item.id === teamId) ?? previewTeams[0]
  const agents = team.members.flatMap((member) => member.agents.map((agent) => ({ ...agent, owner: member.name })))
  const selectedAgent = agents.find((agent) => agent.id === agentId)
  const onlineCount = agents.filter((agent) => agent.online).length

  function navigate(next: RoseSection) {
    setSection(next)
    document.getElementById(`rmp-${next}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  function selectTeam(id: string) {
    setTeamId(id)
    setAgentId(null)
    setCopyState('idle')
  }

  async function copyInvite() {
    try {
      await copyText(team.inviteCode)
      setCopyState('copied')
    } catch {
      setCopyState('error')
    }
  }

  return <div className="rose-main-preview">
    <aside className="rmp-sidebar" aria-label="로즈 시안 메뉴">
      <a className="rmp-brand" href="/" aria-label="DevLink 워크스페이스로"><BrandLogo /></a>
      <div className="rmp-space-label"><span>MY WORKSPACE</span><span>01</span></div>
      <nav className="rmp-nav" aria-label="워크스페이스 메뉴">
        <button type="button" className={section === 'overview' ? 'is-active' : ''} aria-current={section === 'overview' ? 'page' : undefined} onClick={() => navigate('overview')}><Icon name="grid" size={18} />워크스페이스<span className="rmp-nav-dot" /></button>
        <button type="button" className={section === 'teams' ? 'is-active' : ''} aria-current={section === 'teams' ? 'page' : undefined} onClick={() => navigate('teams')}><Icon name="team" size={18} />내 팀<span className="rmp-nav-count">02</span></button>
        <button type="button" className={section === 'agents' ? 'is-active' : ''} aria-current={section === 'agents' ? 'page' : undefined} onClick={() => navigate('agents')}><Icon name="agent" size={18} />에이전트</button>
      </nav>
      <div className="rmp-sidebar-rule" />
      <div className="rmp-space-label"><span>YOUR TEAMS</span><Icon name="team" size={12} /></div>
      <div className="rmp-team-nav">{previewTeams.map((item, index) => <button type="button" key={item.id} className={team.id === item.id ? 'is-selected' : ''} aria-pressed={team.id === item.id} onClick={() => { selectTeam(item.id); navigate('teams') }}><i className={index === 0 ? 'rmp-team-dot-rose' : 'rmp-team-dot-purple'} />{item.name}<Icon name="chevron" size={12} /></button>)}</div>
      <div className="rmp-sidebar-bottom">
        <div className="rmp-help-card"><span className="rmp-help-symbol" aria-hidden="true">✳</span><strong>처음이라도, 괜찮아요.</strong><p>팀과 Agent를 연결하는<br />작은 시작을 함께해요.</p><button type="button" onClick={() => setDialog('guide')}>시작 가이드<Icon name="arrow" size={14} /></button></div>
        <div className="rmp-profile"><span>보경</span><div><strong>최보경</strong><small>Personal workspace</small></div><span className="rmp-profile-indicator" /></div>
      </div>
    </aside>

    <div className="rmp-main-shell">
      <header className="rmp-topbar"><div><span>Workspace</span><Icon name="chevron" size={12} /><strong>Overview</strong></div><span className="rmp-edition">ROSE ATELIER <i /> EDITION 01</span><span className="rmp-topbar-avatar" aria-label="최보경 프로필">보경</span></header>
      <main className="rmp-main" id="rmp-overview">
        <div className="rmp-page-heading"><div><span className="rmp-eyebrow">A LITTLE SPACE, ENDLESS POSSIBILITIES</span><h1>반가워요, 보경님<span>✦</span></h1><p>오늘도 함께 만들 준비가 되었나요?</p></div><span className="rmp-date"><i />2026년 11월 2일, 월요일</span></div>

        <section className="rmp-hero" aria-label="워크스페이스 소개">
          <div className="rmp-hero-copy"><span className="rmp-hero-label"><span />YOUR NEXT CHAPTER</span><h2>작은 연결이,<br />큰 가능성이 되는 곳.</h2><p>좋은 동료, 든든한 Agent와 함께.<br />우리의 아이디어가 자라나는 공간, DevLink.</p><button type="button" onClick={() => navigate('teams')}>내 팀 둘러보기<Icon name="arrow" size={16} /></button><span className="rmp-hero-caption">Build something lovely, together.</span></div>
          <div className="rmp-hero-art" aria-hidden="true">
            <span className="rmp-art-orbit rmp-art-orbit-one" /><span className="rmp-art-orbit rmp-art-orbit-two" />
            <span className="rmp-art-spark rmp-art-spark-one">✦</span><span className="rmp-art-spark rmp-art-spark-two">✳</span>
            <div className="rmp-art-window"><div className="rmp-art-window-bar"><i /><i /><i /><span>our little workspace</span></div><div className="rmp-art-window-body"><BrandLogo variant="icon" className="rmp-art-logo" /><span className="rmp-art-line" /><span className="rmp-art-line rmp-art-line-short" /><div className="rmp-art-people"><span>보경</span><span>정민</span><span>효민</span><b>+3</b></div><div className="rmp-art-window-footer"><i />Better, together.</div></div></div>
            <div className="rmp-art-agent"><span className="rmp-art-agent-antenna" /><div className="rmp-art-agent-face"><i /><i /><b /></div><span>your little co-builder</span></div>
            <div className="rmp-art-chip"><span><Icon name="check" size={12} /></span>함께할 준비 완료</div>
            <span className="rmp-art-caption">PEOPLE + AGENTS = POSSIBILITIES</span>
          </div>
        </section>

        <section className="rmp-stat-strip" aria-label="워크스페이스 요약">
          <div><span className="rmp-stat-icon"><Icon name="team" size={20} /></span><span><small>함께하는 팀</small><strong>{String(previewTeams.length).padStart(2, '0')}<em>개의 공간</em></strong></span></div>
          <div><span className="rmp-stat-icon"><Icon name="agent" size={20} /></span><span><small>{team.name}의 Agent</small><strong>{String(agents.length).padStart(2, '0')}<em>명의 든든한 동료</em></strong></span></div>
          <div><span className="rmp-stat-icon"><Icon name="shield" size={20} /></span><span><small>지금 연결된 Agent</small><strong>{String(onlineCount).padStart(2, '0')}<em><i />온라인</em></strong></span></div>
        </section>

        <section className="rmp-teams-section" id="rmp-teams" aria-labelledby="rmp-teams-title">
          <div className="rmp-section-heading"><div><span className="rmp-eyebrow">SPACES TO GROW</span><h2 id="rmp-teams-title">우리의 팀 공간<span>02</span></h2></div><button type="button" className="rmp-text-button" onClick={() => { setDialog('invite'); setCopyState('idle') }}>동료 초대하기<Icon name="plus" size={15} /></button></div>
          <div className="rmp-team-grid">{previewTeams.map((item, index) => <button type="button" className={`rmp-team-card ${index === 1 ? 'rmp-team-card-lavender' : ''} ${team.id === item.id ? 'is-selected' : ''}`} aria-pressed={team.id === item.id} key={item.id} onClick={() => selectTeam(item.id)}><span className="rmp-team-card-top"><span className="rmp-team-emblem">{index === 0 ? '✳' : '⌘'}</span><span className="rmp-team-role">{index === 0 ? 'OWNER' : 'MEMBER'}</span><span className="rmp-team-selected"><Icon name={team.id === item.id ? 'check' : 'arrow'} size={15} /></span></span><strong>{item.name}</strong><p>{item.description}</p><span className="rmp-team-card-bottom"><span className="rmp-team-avatars">{item.members.slice(0, 3).map((member) => <span key={member.id}>{member.initials.slice(0, 1)}</span>)}<b>+{item.members.length - 3}</b></span><span>팀원 {item.members.length}<i />Agent {item.members.flatMap((member) => member.agents).length}</span></span></button>)}</div>
        </section>

        <div className="rmp-bottom-grid">
          <section className="rmp-agents-panel" id="rmp-agents" aria-labelledby="rmp-agents-title"><div className="rmp-panel-heading"><div><span className="rmp-eyebrow">YOUR CO-BUILDERS</span><h2 id="rmp-agents-title">함께하는 Agent<span>{agents.length}</span></h2></div><span className="rmp-selected-team-label">{team.name}</span></div><div className="rmp-agent-list">{agents.slice(0, 4).map((agent) => <button className="rmp-agent-row" type="button" key={agent.id} onClick={() => setAgentId(agent.id)}><span className={`rmp-agent-avatar ${agent.tool === 'Claude Code' ? 'rmp-agent-avatar-claude' : ''}`}>{agent.tool === 'Codex' ? <Icon name="agent" size={20} /> : '✳'}</span><span className="rmp-agent-name"><strong>{agent.name}</strong><small>{agent.tool}<i />{agent.owner}</small></span><span className={`rmp-agent-status ${agent.online ? 'is-online' : ''}`}><i />{agent.online ? '연결됨' : '오프라인'}</span><Icon name="chevron" size={14} /></button>)}</div><p className="rmp-panel-footnote">Agent를 선택하면 담당 프로젝트를 확인할 수 있어요.</p></section>
          <section className="rmp-members-panel" aria-labelledby="rmp-members-title"><div className="rmp-panel-heading"><div><span className="rmp-eyebrow">GOOD COMPANY</span><h2 id="rmp-members-title">함께여서 좋은 사람들</h2></div><span className="rmp-member-total">{team.members.length}</span></div><div className="rmp-member-list">{team.members.slice(0, 4).map((member, index) => <div className="rmp-member-row" key={member.id}><span className={`rmp-member-avatar rmp-member-avatar-${index % 3}`}>{member.initials}</span><div><strong>{member.name}{member.id === 'jiwoo' && <small>나</small>}</strong><span>{member.role === 'OWNER' ? 'Team owner' : 'Team member'}</span></div><span>{member.agents.length} Agent</span></div>)}</div><div className="rmp-members-note"><span aria-hidden="true">♡</span><p>각자의 가능성을 모아,<br />함께 더 멀리 나아가요.</p></div></section>
        </div>

        <footer className="rmp-footer"><span><BrandLogo variant="wordmark" className="rmp-footer-logo" /><small>A space to build, together.</small></span><span>Rose Atelier · 목업 데이터로 구성된 메인 페이지 시안</span></footer>
      </main>
    </div>

    {selectedAgent && <Modal title={selectedAgent.name} description={`${selectedAgent.tool} · ${team.name}`} onClose={() => setAgentId(null)}><div className="rmp-agent-detail"><span className="rmp-agent-detail-icon"><Icon name="agent" size={30} /></span><span className={`rmp-agent-status ${selectedAgent.online ? 'is-online' : ''}`}><i />{selectedAgent.online ? '지금 연결되어 있어요' : '지금은 오프라인이에요'}</span><dl><div><dt>담당 프로젝트</dt><dd>{selectedAgent.project}</dd></div><div><dt>함께하는 팀원</dt><dd>{selectedAgent.owner}</dd></div></dl><p>{selectedAgent.description}</p></div><button type="button" className="rmp-modal-button" onClick={() => setAgentId(null)}>확인했어요<Icon name="check" size={16} /></button></Modal>}
    {dialog === 'invite' && <Modal title="함께할 동료를 초대해요" description={`${team.name}의 초대 코드입니다.`} onClose={() => setDialog(null)}><div className="rmp-invite-note"><span>AN INVITATION TO BUILD TOGETHER</span><label htmlFor="rmp-invite-code">팀 초대 코드</label><input id="rmp-invite-code" value={team.inviteCode} readOnly onFocus={(event) => event.currentTarget.select()} /><p>디자인 확인용 코드이며 실제 팀 초대는 진행되지 않아요.</p></div><p className="rmp-copy-status" role="status">{copyState === 'copied' ? '초대 코드를 복사했어요.' : copyState === 'error' ? '위 코드를 선택해 직접 복사해주세요.' : '좋은 동료와 새로운 시작을 함께하세요.'}</p><button type="button" className="rmp-modal-button" onClick={() => { void copyInvite() }}><Icon name={copyState === 'copied' ? 'check' : 'copy'} size={16} />{copyState === 'copied' ? '복사 완료' : '초대 코드 복사'}</button></Modal>}
    {dialog === 'guide' && <Modal title="작은 연결부터 시작하세요" description="DevLink의 공간을 둘러보는 세 가지 방법" onClose={() => setDialog(null)}><ol className="rmp-guide"><li><span>01</span><div><strong>나의 팀 공간 고르기</strong><p>팀 카드를 누르면 해당 팀의 동료와 Agent가 표시돼요.</p></div></li><li><span>02</span><div><strong>Agent와 인사하기</strong><p>Agent 목록에서 이름을 선택해 담당 프로젝트를 확인하세요.</p></div></li><li><span>03</span><div><strong>함께할 동료 초대하기</strong><p>동료 초대하기에서 디자인 확인용 초대 코드를 볼 수 있어요.</p></div></li></ol><button className="rmp-modal-button" type="button" onClick={() => setDialog(null)}>시작해볼게요<Icon name="arrow" size={16} /></button></Modal>}
  </div>
}
