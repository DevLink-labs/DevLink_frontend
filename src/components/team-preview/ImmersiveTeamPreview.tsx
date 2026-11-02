import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from '../ui'
import PageTitle from '../PageTitle'
import TeamSpaceLink from '../TeamSpaceLink'
import { copyText } from '../../lib/utils'
import ImmersiveTeamScene from './ImmersiveTeamScene'
import FocusedMemberDetails from './FocusedMemberDetails'
import TeamWorkspaceDashboard from './TeamWorkspaceDashboard'
import { immersivePreviewTeams } from './immersivePreviewData'
import './ImmersiveTeamPreview.css'
import './ImmersiveExperience.css'
import './RefinedTeamPreview.css'

function MotionIcon({ paused }: { paused: boolean }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paused ? <path d="m9 5 11 7-11 7V5Z" /> : <><path d="M8 5v14M16 5v14" /></>}</svg>
}

function SpreadIcon() {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M4 4l5 5M20 4l-5 5M20 20l-5-5M4 20l5-5" /></svg>
}

function MemberIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="7.5" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>
}

const memberColors: Record<string, string> = {
  sage: '#858585', blue: '#6b6b6b', peach: '#a5a5a5',
  lavender: '#909090', sand: '#bdbdbd', mint: '#999999',
}

export default function ImmersiveTeamPreview() {
  const [teamId, setTeamId] = useState(immersivePreviewTeams[0].id)
  const [selectedMemberId, setSelectedMemberId] = useState(immersivePreviewTeams[0].members[0].id)
  const [focusedMemberId, setFocusedMemberId] = useState<string | null>(null)
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [exploded, setExploded] = useState(false)
  const [availability, setAvailability] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [sceneInteractive, setSceneInteractive] = useState(true)
  const experienceRoot = useRef<HTMLDivElement>(null)
  const journey = useRef<HTMLElement>(null)
  const stickyStage = useRef<HTMLDivElement>(null)
  const dashboardSection = useRef<HTMLElement>(null)
  const sceneScrollState = useRef({ progress: 0, requestRender: () => {} })
  const inviteDialog = useRef<HTMLDialogElement>(null)
  const copyAttempt = useRef(0)
  const team = immersivePreviewTeams.find((item) => item.id === teamId) ?? immersivePreviewTeams[0]
  const member = team.members.find((item) => item.id === selectedMemberId) ?? team.members[0]
  const agents = team.members.flatMap((item) => item.agents)
  const color = memberColors[member.color] ?? memberColors.sage

  const onAvailabilityChange = useCallback((available: boolean) => {
    setAvailability(available ? 'ready' : 'unavailable')
  }, [])

  const selectMember = useCallback((id: string) => {
    setSelectedMemberId(id)
    setFocusedMemberId(id)
  }, [])

  const selectDashboardMember = useCallback((id: string) => {
    setSelectedMemberId(id)
    setFocusedMemberId(null)
  }, [])

  const returnToOverview = useCallback(() => {
    setFocusedMemberId(null)
  }, [])

  useEffect(() => {
    const root = experienceRoot.current
    const section = journey.current
    const stage = stickyStage.current
    if (!root || !section || !stage) return
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    let frame = 0
    let interactive = true

    const paint = () => {
      frame = 0
      const travel = Math.max(section.offsetHeight - stage.offsetHeight, 1)
      const progress = Math.max(0, Math.min(1, -section.getBoundingClientRect().top / travel))
      const normalized = Math.max(0, Math.min(1, (progress - 0.04) / 0.92))
      const reveal = normalized * normalized * (3 - 2 * normalized)
      root.style.setProperty('--itp-scroll', progress.toFixed(4))
      root.style.setProperty('--itp-reveal', reveal.toFixed(4))
      root.style.setProperty('--itp-hud-opacity', Math.max(0, 1 - progress * 2.4).toFixed(4))
      root.style.setProperty('--itp-scene-opacity', (1 - reveal).toFixed(4))
      root.style.setProperty('--itp-blur', `${(reveal * 12).toFixed(2)}px`)
      root.style.setProperty('--itp-scene-scale', (1 - reveal * 0.12).toFixed(4))
      root.style.setProperty('--itp-scene-y', `${(-reveal * 56).toFixed(2)}px`)
      root.style.setProperty('--itp-dashboard-scale', (0.96 + reveal * 0.04).toFixed(4))
      root.style.setProperty('--itp-wash', reveal.toFixed(4))
      const nextInteractive = progress < 0.12
      if (nextInteractive !== interactive) {
        interactive = nextInteractive
        setSceneInteractive(nextInteractive)
      }
      if (Math.abs(sceneScrollState.current.progress - progress) > 0.0001) {
        sceneScrollState.current.progress = progress
        sceneScrollState.current.requestRender()
      }
    }

    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(paint) }
    const observer = new ResizeObserver(schedule)
    observer.observe(section)
    observer.observe(stage)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    paint()
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.history.scrollRestoration = previousRestoration
    }
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = (event: MediaQueryListEvent) => setPaused(event.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const dialog = inviteDialog.current
    if (inviteOpen && !dialog?.open) dialog?.showModal()
    else if (!inviteOpen && dialog?.open) dialog.close()
    return () => { if (dialog?.open) dialog.close() }
  }, [inviteOpen])

  useEffect(() => () => { copyAttempt.current++ }, [])

  useEffect(() => {
    if (!focusedMemberId || inviteOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') returnToOverview()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [focusedMemberId, inviteOpen, returnToOverview])

  function scrollToSection(section: HTMLElement | null) {
    if (!section) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const top = window.scrollY + section.getBoundingClientRect().top
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' })
  }

  function showDashboard() {
    scrollToSection(dashboardSection.current)
  }

  function showScene() {
    returnToOverview()
    scrollToSection(journey.current)
  }

  function focusMemberFromDashboard(id: string) {
    selectMember(id)
    scrollToSection(journey.current)
  }

  function openInvite() {
    setCopyStatus('idle')
    setInviteOpen(true)
  }

  function changeTeam(id: string) {
    const nextTeam = immersivePreviewTeams.find((item) => item.id === id)
    if (!nextTeam || nextTeam.id === teamId) return
    setTeamId(id)
    selectDashboardMember(nextTeam.members[0].id)
    setAvailability('loading')
    setExploded(false)
    closeInvite()
  }

  function closeInvite() {
    copyAttempt.current++
    setInviteOpen(false)
    setCopyStatus('idle')
  }

  async function copyInvite() {
    const attempt = ++copyAttempt.current
    try {
      await copyText(team.inviteCode)
      if (copyAttempt.current === attempt) setCopyStatus('copied')
    } catch {
      if (copyAttempt.current === attempt) setCopyStatus('error')
    }
  }

  return <div className="itp-experience" ref={experienceRoot}>
    <PageTitle title="3D 팀 스페이스" />
    <section className="itp-journey" ref={journey} aria-label="3D 팀 스페이스">
      <div className="itp-stage-sticky" ref={stickyStage}>
        <div className={`immersive-team-preview ${paused ? 'is-paused' : ''} ${exploded ? 'is-exploded' : ''} ${focusedMemberId ? 'is-focused' : ''}`} inert={!sceneInteractive}>
    <div className="itp-scene"><ImmersiveTeamScene teamName={team.name} members={team.members} selectedMemberId={member.id} focusedMemberId={focusedMemberId} scrollState={sceneScrollState} onSelectMember={selectMember} paused={paused} exploded={exploded} onAvailabilityChange={onAvailabilityChange} />
      {availability === 'loading' && <div className="itp-loading-overlay" role="status"><span className="itp-loader" /><span>공간을 준비하는 중</span></div>}
      {availability === 'unavailable' && <div className="itp-fallback"><div className="itp-fallback-core"><span className="itp-fallback-hub-model" aria-hidden="true"><i /><i /><i /></span><span className="itp-fallback-team-name">{team.name}</span></div><div className="itp-fallback-members">{team.members.map((item, index) => <button key={item.id} type="button" className={member.id === item.id ? 'is-active' : ''} onClick={() => selectMember(item.id)} aria-label={`${item.name} 선택`} aria-pressed={member.id === item.id} style={{ '--itp-index': index, '--itp-count': team.members.length, '--itp-member-color': memberColors[item.color] } as CSSProperties}><span className="itp-fallback-node" aria-hidden="true"><i /><i /><i /></span><span className="itp-fallback-companions" aria-hidden="true">{item.agents.map((agent) => <span key={agent.id} className={`itp-fallback-companion ${agent.online ? 'is-online' : ''}`}><i /><i /><b /></span>)}</span><strong>{item.name}</strong></button>)}</div><span className="itp-fallback-note">이 환경에서는 기본 그래픽으로 표시해요</span></div>}
    </div>
    <div className="itp-ambient" aria-hidden="true"><i /><i /><i /></div>
    <div className="itp-ui">
      <header className="itp-header"><a href="/" className="itp-brand" aria-label="DevLink 워크스페이스"><span className="itp-brand-symbol">D<i /></span><span className="itp-brand-word">DevLink</span></a><div className="itp-header-actions"><TeamSpaceLink edition={2} /><TeamSpaceLink edition={3} />{focusedMemberId && <button type="button" className="itp-overview-button" onClick={returnToOverview}><Icon name="arrow" size={17} />전체 팀 보기</button>}<button className="itp-dashboard-jump" type="button" onClick={showDashboard}>대시보드<Icon name="chevron" size={16} /></button><button type="button" className="itp-icon-button" onClick={() => setPaused(!paused)} aria-label={paused ? '애니메이션 재생' : '애니메이션 일시정지'} title={paused ? '애니메이션 재생' : '애니메이션 일시정지'} aria-pressed={paused}><MotionIcon paused={paused} /></button></div></header>
      <div className="itp-main">
        <section className="itp-hero" key={team.id}><div className="itp-team-picker"><h1>{team.name}</h1><Icon name="chevron" size={20} /><select value={team.id} onChange={(event) => changeTeam(event.target.value)} aria-label="팀 선택">{immersivePreviewTeams.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></div></section>
        <div className="itp-stats" aria-label={`팀원 ${team.members.length}명, 에이전트 ${agents.length}개`}><div><strong>{team.members.length}</strong><span>팀원</span></div><span className="itp-stat-line" /><div><strong>{agents.length}</strong><span>에이전트</span></div></div>
        {focusedMemberId && <FocusedMemberDetails key={`${team.id}-${member.id}`} member={member} teamName={team.name} color={color} onClose={returnToOverview} onOpenDashboard={showDashboard} />}
        <p className="itp-sr-only">팀원을 선택하면 카메라가 이동합니다. 전체 팀 보기 버튼이나 Escape 키로 돌아올 수 있습니다. 아래로 스크롤하면 팀 대시보드가 나타납니다.</p>
      </div>
      <div className="itp-bottom"><div className="itp-orbit-controls"><button type="button" className="itp-icon-button" onClick={() => setExploded(!exploded)} aria-label={exploded ? '모아 보기' : '펼쳐 보기'} title={exploded ? '모아 보기' : '펼쳐 보기'} aria-pressed={exploded}><SpreadIcon /></button><span className="itp-bottom-note">드래그하여 둘러보기</span></div><div className="itp-dock" role="group" aria-label="팀원 선택">{team.members.map((item) => <button type="button" className={`itp-member ${member.id === item.id ? 'is-active' : ''}`} key={item.id} style={{ '--itp-member-color': memberColors[item.color] } as CSSProperties} aria-pressed={member.id === item.id} aria-label={`${item.name} 선택`} onClick={() => selectMember(item.id)}><span className="itp-member-avatar" aria-hidden="true"><MemberIcon /></span><span className="itp-member-name">{item.name}</span><span className="itp-member-dot" /></button>)}</div><button type="button" className="itp-invite-trigger" onClick={openInvite} aria-label="팀원 초대" title="팀원 초대"><Icon name="plus" size={23} /></button></div>
      <button type="button" className="itp-scroll-prompt" onClick={showDashboard}><span>아래로 스크롤</span><Icon name="chevron" size={17} /></button>
    </div>
        </div>
        <div className="itp-scroll-wash" aria-hidden="true" />
      </div>
    </section>
    <section className="itp-dashboard-section" id="team-dashboard" ref={dashboardSection} aria-label="팀 대시보드">
      <div className="itp-dashboard-frame"><TeamWorkspaceDashboard key={team.id} team={team} teams={immersivePreviewTeams} selectedMemberId={member.id} onSelectTeam={changeTeam} onSelectMember={selectDashboardMember} onFocusMember={focusMemberFromDashboard} onInvite={openInvite} onReturnToScene={showScene} /></div>
    </section>
    <dialog ref={inviteDialog} className="itp-invite-dialog" aria-labelledby="itp-invite-title" onCancel={(event) => { event.preventDefault(); closeInvite() }} onClick={(event) => { if (event.target === event.currentTarget) closeInvite() }}><div className="itp-invite-heading"><h2 id="itp-invite-title">{team.name}</h2><button type="button" className="itp-icon-button" onClick={closeInvite} aria-label="초대 카드 닫기"><Icon name="close" size={19} /></button></div><label htmlFor="itp-invite-code">초대 코드</label><input id="itp-invite-code" value={team.inviteCode} readOnly onFocus={(event) => event.currentTarget.select()} /><button type="button" className="itp-copy" onClick={() => { void copyInvite() }}><Icon name={copyStatus === 'copied' ? 'check' : 'copy'} size={16} />{copyStatus === 'copied' ? '복사 완료' : '초대 코드 복사'}</button><p className="itp-invite-note" role="status">{copyStatus === 'error' ? '코드를 선택해 직접 복사해주세요.' : '미리보기용 초대 코드'}</p></dialog>
  </div>
}
