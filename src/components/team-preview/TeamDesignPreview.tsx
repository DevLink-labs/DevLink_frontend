import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import { Icon, Modal } from '../ui'
import { copyText } from '../../lib/utils'
import SpatialStudio from './SpatialStudio'
import RoseMainPreview from './RoseMainPreview'
import SlateMainPreview from './SlateMainPreview'
import MauveMainPreview from './MauveMainPreview'
import CobaltMainPreview from './CobaltMainPreview'
import ForestMainPreview from './ForestMainPreview'
import DesignPreviewNavigation, { readDesignPreviewView } from './DesignPreviewNavigation'
import type { DesignPreviewView } from './DesignPreviewNavigation'
import { previewTeams } from './previewData'
import type { PreviewAgent, PreviewMember } from './previewData'
import './TeamDesignPreview.css'
import './SpatialStudioShell.css'

function Avatar({ member, small = false }: { member: PreviewMember; small?: boolean }) {
  return <span className={`tp-avatar tp-color-${member.color} ${small ? 'tp-avatar-small' : ''}`} aria-hidden="true"><span>{member.initials}</span><i /><b /></span>
}

function ToolMark({ tool }: { tool: PreviewAgent['tool'] }) {
  return <span className={`tp-tool-mark ${tool === 'Codex' ? 'tp-tool-codex' : 'tp-tool-claude'}`} aria-hidden="true">{tool === 'Codex' ? <Icon name="agent" size={15} /> : '✳'}</span>
}

function tiltCard(event: PointerEvent<HTMLButtonElement>) {
  if (event.pointerType !== 'mouse') return
  const bounds = event.currentTarget.getBoundingClientRect()
  const x = (event.clientX - bounds.left) / bounds.width
  const y = (event.clientY - bounds.top) / bounds.height
  event.currentTarget.style.setProperty('--tp-rx', `${(0.5 - y) * 5}deg`)
  event.currentTarget.style.setProperty('--tp-ry', `${(x - 0.5) * 5}deg`)
  event.currentTarget.style.setProperty('--tp-light-x', `${x * 100}%`)
  event.currentTarget.style.setProperty('--tp-light-y', `${y * 100}%`)
}

function resetCard(event: PointerEvent<HTMLButtonElement>) {
  event.currentTarget.style.setProperty('--tp-rx', '0deg')
  event.currentTarget.style.setProperty('--tp-ry', '0deg')
}

function MemberCard({ member, selected, onSelect, index }: { member: PreviewMember; selected: boolean; onSelect: () => void; index: number }) {
  const onlineCount = member.agents.filter((agent) => agent.online).length
  return <button
    className={`tp-member-card ${selected ? 'is-selected' : ''}`}
    type="button"
    aria-pressed={selected}
    aria-label={`${member.name}, ${member.role === 'OWNER' ? '팀 소유자' : '팀원'}, Agent ${member.agents.length}개. 상세 보기`}
    onClick={onSelect}
    onPointerMove={tiltCard}
    onPointerLeave={resetCard}
    style={{ '--tp-index': index } as CSSProperties}
  >
    <span className="tp-card-top"><span className={`tp-role ${member.role === 'OWNER' ? 'tp-role-owner' : ''}`}>{member.role === 'OWNER' && <span aria-hidden="true">♔</span>}{member.role === 'OWNER' ? 'Team owner' : 'Member'}</span><span className="tp-card-arrow"><Icon name={selected ? 'check' : 'arrow'} size={15} /></span></span>
    <span className="tp-card-person"><Avatar member={member} /><strong>{member.name}<span>{member.id === 'jiwoo' ? '나' : ''}</span></strong><span className="tp-handle">@{member.nickname}</span></span>
    <span className="tp-card-agents"><span className="tp-card-agent-label">AGENTS <b>{String(member.agents.length).padStart(2, '0')}</b><span className={`tp-mini-status ${onlineCount ? 'is-online' : ''}`} />{onlineCount} 연결됨</span><span className="tp-agent-chips">{member.agents.map((agent) => <span className="tp-agent-chip" key={agent.id}><ToolMark tool={agent.tool} /><span>{agent.name}</span></span>)}</span></span>
    <span className="tp-card-glow" aria-hidden="true" />
  </button>
}

function MemberDetail({ member, clean = false }: { member: PreviewMember; clean?: boolean }) {
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(member.agents[0]?.id ?? null)
  return <aside className="tp-detail" aria-label={`${member.name} 상세 정보`}>
    <div className="tp-detail-eyebrow"><span>{clean ? '팀원 정보' : 'MEMBER PROFILE'}</span><span className="tp-detail-dot" /></div>
    <div className="tp-detail-profile"><Avatar member={member} /><h3>{member.name}<span>{member.id === 'jiwoo' && '나'}</span></h3><p>@{member.nickname}</p><span className={`tp-role ${member.role === 'OWNER' ? 'tp-role-owner' : ''}`}>{member.role === 'OWNER' ? (clean ? '소유자' : '♔ Team owner') : (clean ? '팀원' : 'Team member')}</span></div>
    <dl className="tp-detail-meta"><div><dt>참여일</dt><dd>{member.joinedAt}</dd></div><div><dt>등록된 Agent</dt><dd>{member.agents.length}개</dd></div></dl>
    <div className="tp-detail-section-heading"><h4>함께하는 Agent</h4><span>{String(member.agents.length).padStart(2, '0')}</span></div>
    <div className="tp-detail-agents">{member.agents.map((agent) => {
      const expanded = expandedAgentId === agent.id
      return <div className={`tp-detail-agent ${expanded ? 'is-expanded' : ''}`} key={agent.id}>
        <button type="button" onClick={() => setExpandedAgentId(expanded ? null : agent.id)} aria-expanded={expanded} aria-controls={`tp-agent-${agent.id}`}><ToolMark tool={agent.tool} /><span><strong>{agent.name}</strong><small>{agent.tool}</small></span><span className={`tp-agent-status ${agent.online ? 'is-online' : ''}`} title={agent.online ? 'Agent 온라인' : 'Agent 오프라인'}><i />{agent.online ? (clean ? '온라인' : 'Online') : (clean ? '오프라인' : 'Offline')}</span><Icon name="chevron" size={13} /></button>
        <div className="tp-agent-expanded" id={`tp-agent-${agent.id}`} hidden={!expanded}><span className="tp-project"><Icon name="grid" size={12} />{agent.project}</span><p>{agent.description}</p></div>
      </div>
    })}</div>
    <div className="tp-detail-footnote"><Icon name="shield" size={14} /><p>연결 상태는 Agent 기준으로 표시돼요.</p></div>
  </aside>
}

export default function TeamDesignPreview() {
  const [view, setView] = useState<DesignPreviewView>(readDesignPreviewView)
  const [teamId, setTeamId] = useState(previewTeams[0].id)
  const [selectedMemberId, setSelectedMemberId] = useState(previewTeams[0].members[0].id)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [calm, setCalm] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyAttempt = useRef(0)
  const team = previewTeams.find((item) => item.id === teamId) ?? previewTeams[0]
  const member = team.members.find((item) => item.id === selectedMemberId) ?? team.members[0]
  const agents = team.members.flatMap((item) => item.agents)
  const onlineAgents = agents.filter((agent) => agent.online).length

  useEffect(() => () => { copyAttempt.current++; if (copyTimer.current) clearTimeout(copyTimer.current) }, [])

  useEffect(() => {
    const restoreView = () => {
      setView(readDesignPreviewView())
      copyAttempt.current++
      if (copyTimer.current) clearTimeout(copyTimer.current)
      setInviteOpen(false)
      setCopied(false)
      setCopyError(false)
    }
    window.addEventListener('popstate', restoreView)
    return () => window.removeEventListener('popstate', restoreView)
  }, [])

  function changeView(nextView: DesignPreviewView) {
    if (nextView === view) return
    setView(nextView)
    closeInvite()
    const url = new URL(window.location.href)
    url.searchParams.set('view', nextView)
    window.history.pushState(null, '', url)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }

  function changeTeam(nextTeamId: string) {
    const nextTeam = previewTeams.find((item) => item.id === nextTeamId)
    if (!nextTeam) return
    setTeamId(nextTeam.id)
    setSelectedMemberId(nextTeam.members[0].id)
    closeInvite()
  }

  function openInvite() {
    setCopied(false)
    setCopyError(false)
    setInviteOpen(true)
  }

  function closeInvite() {
    copyAttempt.current++
    if (copyTimer.current) clearTimeout(copyTimer.current)
    setInviteOpen(false)
    setCopied(false)
    setCopyError(false)
  }

  async function copyInvite() {
    const attempt = ++copyAttempt.current
    try {
      await copyText(team.inviteCode)
      if (attempt !== copyAttempt.current) return
      setCopied(true)
      setCopyError(false)
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2400)
    } catch {
      if (attempt === copyAttempt.current) setCopyError(true)
    }
  }

  if (view !== 'gallery' && view !== 'studio') return <div className="design-preview-browser">
    <DesignPreviewNavigation view={view} onChange={changeView} />
    <div id="design-preview-panel" role="tabpanel" aria-labelledby={`design-tab-${view}`} tabIndex={0}>
      {view === 'rose' ? <RoseMainPreview />
        : view === 'mauve' ? <MauveMainPreview />
          : view === 'cobalt' ? <CobaltMainPreview />
            : view === 'forest' ? <ForestMainPreview />
              : <SlateMainPreview key={view} appearance={view === 'blanc' ? 'rose-blanc' : 'slate'} />}
    </div>
  </div>

  return <div className="design-preview-browser">
    <DesignPreviewNavigation view={view} onChange={changeView} />
    <div id="design-preview-panel" role="tabpanel" aria-labelledby={`design-tab-${view}`} tabIndex={0} className={`team-preview ${calm ? 'tp-calm' : ''} ${view === 'studio' ? 'tp-studio-preview' : ''}`}>
    <aside className="tp-rail">
      <a className="tp-logo" href="/" aria-label="DevLink 워크스페이스로">D<span /></a>
      <nav aria-label="디자인 미리보기"><span className="tp-rail-line" /><button type="button" className={view === 'gallery' ? 'is-active' : ''} aria-label="Glass Deck 보기" aria-pressed={view === 'gallery'} title="Glass Deck" onClick={() => changeView('gallery')}><Icon name="grid" size={21} /></button><button type="button" className={view === 'studio' ? 'is-active' : ''} aria-label="Spatial Studio 보기" aria-pressed={view === 'studio'} title="Spatial Studio" onClick={() => changeView('studio')}><span className="tp-cube-icon" /></button></nav>
      <div className="tp-rail-bottom"><span className="tp-rail-monogram">JW</span><span>DEVLINK</span></div>
    </aside>

    <div className="tp-shell">
      <header className="tp-topbar"><div className="tp-breadcrumb"><span>Workspace</span><Icon name="chevron" size={12} /><strong>팀 스페이스</strong></div><div className="tp-topbar-actions"><span className="tp-preview-label"><i />DESIGN PREVIEW</span><a href="/">워크스페이스로 <Icon name="arrow" size={15} /></a></div></header>

      <main className="tp-main">
        {view === 'studio' ? <div className="tp-page-heading"><div><h1>팀 배치도</h1><p>{team.name} · 팀원 {team.members.length}명 · 온라인 에이전트 {onlineAgents}개</p></div></div> : <div className="tp-page-heading"><div><span className="tp-eyebrow">YOUR PEOPLE. YOUR POSSIBILITIES.</span><h1>함께라서, 더 멀리<span>.</span></h1><p>팀을 이루는 사람들과 그 곁의 Agent를 만나보세요.</p></div><div className="tp-preview-options"><span className="dpn-current-design">{view === 'gallery' ? '01 / GLASS DECK' : '02 / SPATIAL STUDIO'}</span></div></div>}

        {view === 'studio' ? <section className="tp-team-banner" aria-label="현재 팀 정보" key={team.id}><div className="tp-team-identity"><div><div className="tp-team-picker"><h2>{team.name}</h2><Icon name="chevron" size={15} /><select value={team.id} onChange={(event) => changeTeam(event.target.value)} aria-label="미리보기 팀 선택">{previewTeams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><p>{team.description}</p></div></div></section> : <section className="tp-team-banner" aria-label="현재 팀 정보" key={team.id}>
          <div className="tp-team-identity"><div className="tp-team-emblem" aria-hidden="true"><span /><span /><span /><span /></div><div><div className="tp-team-caption">TEAM SPACE <span>#{team.id === 'orbit' ? '001' : '002'}</span></div><div className="tp-team-picker"><h2>{team.name}</h2><Icon name="chevron" size={15} /><select value={team.id} onChange={(event) => changeTeam(event.target.value)} aria-label="미리보기 팀 선택">{previewTeams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><p>{team.description}</p><span className="tp-team-date">Est. {team.createdAt}</span></div></div>
          <div className="tp-team-stats"><div><span>팀원</span><strong>{String(team.members.length).padStart(2, '0')}<small>명</small></strong><div className="tp-avatar-stack">{team.members.slice(0, 4).map((item) => <Avatar key={item.id} member={item} small />)}{team.members.length > 4 && <span>+{team.members.length - 4}</span>}</div></div><div><span>함께하는 Agent</span><strong>{String(agents.length).padStart(2, '0')}<small>개</small></strong><span className="tp-tools-caption">Codex <i /> Claude Code</span></div><div className="tp-connection-stat"><div className="tp-connection-ring" style={{ '--tp-progress': `${onlineAgents / Math.max(agents.length, 1) * 100}%` } as CSSProperties}><Icon name="agent" size={23} /></div><span><b>{onlineAgents}<small> / {agents.length}</small></b><span><i />Agent 연결됨</span></span></div></div>
          <span className="tp-banner-orbit tp-banner-orbit-one" aria-hidden="true" /><span className="tp-banner-orbit tp-banner-orbit-two" aria-hidden="true" />
        </section>}

        <div className="tp-section-toolbar"><div><h2>{view === 'gallery' ? '우리 팀을 소개합니다' : '팀원 위치'}</h2><span className="tp-count">{team.members.length}</span><span className="tp-section-description">{view === 'gallery' ? '카드를 선택해 더 알아보세요' : '팀원의 자리를 선택해보세요'}</span></div><button className="tp-invite-button" type="button" onClick={openInvite}><Icon name="plus" size={16} />팀원 초대</button></div>

        <div className={`tp-content tp-content-${view}`} key={`${view}-${team.id}`}>
          {view === 'gallery' ? <section className="tp-member-grid" aria-label="팀원 갤러리">{team.members.map((item, index) => <MemberCard key={item.id} member={item} selected={item.id === member.id} onSelect={() => setSelectedMemberId(item.id)} index={index} />)}</section> : <SpatialStudio members={team.members} selectedMemberId={member.id} onSelectMember={setSelectedMemberId} onInvite={openInvite} />}
          <MemberDetail member={member} key={member.id} clean={view === 'studio'} />
        </div>

        {view === 'studio' ? <footer className="tp-studio-note">샘플 데이터로 구성된 디자인 미리보기입니다.</footer> : <footer className="tp-footer"><span><i />{view === 'gallery' ? 'GLASS TEAM DECK' : 'SPATIAL TEAM STUDIO'}<span className="tp-footer-divider" />목업 데이터로 구성한 디자인 미리보기</span><button type="button" onClick={() => setCalm(!calm)} aria-pressed={calm}><span className={`tp-motion-toggle ${calm ? 'is-off' : ''}`} />모션 {calm ? '줄임' : '켜짐'}</button></footer>}
      </main>
    </div>

    {inviteOpen && <Modal title="함께할 동료를 초대하세요" description={`${team.name}의 새로운 연결을 기다려요.`} onClose={closeInvite}>
      {view === 'studio' ? <div className="tp-invite-ticket"><strong>{team.name}</strong><label htmlFor="tp-invite-code">팀 초대 코드</label><input id="tp-invite-code" readOnly value={team.inviteCode} onFocus={(event) => event.currentTarget.select()} /><span className="tp-ticket-demo">미리보기용 코드 · 실제 초대에 사용할 수 없습니다.</span></div> : <div className="tp-invite-ticket"><span className="tp-ticket-top"><Icon name="key" size={19} /><span>YOU'RE INVITED</span><span className="tp-ticket-star">✳</span></span><strong>{team.name}</strong><p>A space to build, together.</p><div className="tp-ticket-rule"><i /><span /><i /></div><label htmlFor="tp-invite-code">팀 초대 코드</label><input id="tp-invite-code" readOnly value={team.inviteCode} onFocus={(event) => event.currentTarget.select()} /><span className="tp-ticket-demo">디자인 미리보기용 코드입니다</span></div>}
      <p className="tp-invite-copy-note" role="status">{copyError ? '복사하지 못했어요. 위 코드를 선택해 직접 복사해주세요.' : copied ? '초대 코드를 복사했어요.' : '코드를 복사해 함께할 동료에게 전달하세요.'}</p><button className="tp-copy-button" type="button" onClick={() => { void copyInvite() }}><Icon name={copied ? 'check' : 'copy'} size={17} />{copied ? '복사 완료' : '초대 코드 복사'}</button>
    </Modal>}
    </div>
  </div>
}
