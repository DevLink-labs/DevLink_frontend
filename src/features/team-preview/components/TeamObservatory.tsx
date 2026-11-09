import BrandLogo from "@/components/common/BrandLogo";
import { useCallback, useEffect, useRef, useState } from 'react'
import PageTitle from '../../../components/common/PageTitle'
import { Icon } from '../../../components/ui'
import { copyText } from '../../../utils'
import { immersivePreviewTeams } from '../data/immersivePreviewData'
import ObservatoryScene from './ObservatoryScene'
import '../styles/TeamObservatory.css'

type StatusFilter = 'all' | 'online' | 'offline'
type DialogView = 'invite' | 'help' | null

function ControlIcon({ name }: { name: 'search' | 'pause' | 'play' | 'perspective' | 'plan' }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'search' && <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>}
    {name === 'pause' && <path d="M9 5v14M15 5v14" />}
    {name === 'play' && <path d="m8 5 11 7-11 7V5Z" />}
    {name === 'perspective' && <path d="m12 3 9 5v8l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v8" />}
    {name === 'plan' && <><rect x="4" y="4" width="16" height="16" /><path d="M4 10h16M10 10v10" /></>}
  </svg>
}

function Signal({ online }: { online: boolean }) {
  return <span className={`tp2-signal ${online ? 'is-online' : 'is-offline'}`}><i aria-hidden="true" />{online ? '온라인' : '오프라인'}</span>
}

export default function TeamObservatory() {
  const [teamId, setTeamId] = useState(immersivePreviewTeams[0].id)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')
  const [view, setView] = useState<'orbit' | 'top'>('orbit')
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [resetKey, setResetKey] = useState(0)
  const [availability, setAvailability] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const [dialogView, setDialogView] = useState<DialogView>(null)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const copyAttempt = useRef(0)
  const searchRef = useRef<HTMLInputElement>(null)
  const detailTitle = useRef<HTMLHeadingElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const directoryButton = useRef<HTMLButtonElement>(null)
  const previousSelection = useRef<string | null>(null)
  const team = immersivePreviewTeams.find((item) => item.id === teamId) ?? immersivePreviewTeams[0]
  const entries = team.members.flatMap((member) => member.agents.map((agent) => ({ agent, member })))
  const onlineCount = entries.filter(({ agent }) => agent.online).length
  const projectCount = new Set(entries.map(({ agent }) => agent.project)).size
  const selected = entries.find(({ agent }) => agent.id === selectedAgentId)
  const selectedMember = team.members.find((member) => member.id === selectedMemberId)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleEntries = entries.filter(({ agent, member }) => (!selectedMemberId || member.id === selectedMemberId)
    && (statusFilter === 'all' || agent.online === (statusFilter === 'online'))
    && `${agent.name} ${agent.tool} ${agent.project} ${member.name}`.toLocaleLowerCase().includes(normalizedQuery))
  const visibleAgentIds = visibleEntries.map(({ agent }) => agent.id)
  const selectedIndex = visibleEntries.findIndex(({ agent }) => agent.id === selectedAgentId)
  const onAvailabilityChange = useCallback((available: boolean) => setAvailability(available ? 'ready' : 'unavailable'), [])
  const onSelectAgent = useCallback((id: string) => { setSelectedAgentId(id); setDirectoryOpen(false) }, [])
  const panelOpen = directoryOpen || !!selected

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = (event: MediaQueryListEvent) => setPaused(event.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialogView && !dialog?.open) dialog?.showModal()
    else if (!dialogView && dialog?.open) dialog.close()
    return () => { if (dialog?.open) dialog.close() }
  }, [dialogView])

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (dialogView) return
      if (event.key === 'Escape') {
        setSelectedAgentId(null)
        setDirectoryOpen(false)
        directoryButton.current?.focus({ preventScroll: true })
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSelectedAgentId(null)
        setDirectoryOpen(true)
        window.requestAnimationFrame(() => searchRef.current?.focus({ preventScroll: true }))
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [dialogView])

  useEffect(() => () => { copyAttempt.current++ }, [])

  useEffect(() => {
    if (selectedAgentId) detailTitle.current?.focus({ preventScroll: true })
    else if (directoryOpen) searchRef.current?.focus({ preventScroll: true })
    else if (previousSelection.current && (document.activeElement === document.body || panelRef.current?.contains(document.activeElement))) {
      const label = document.querySelector<HTMLButtonElement>(`.obs-agent-label[data-agent-id="${previousSelection.current}"]:not([hidden])`)
      const focusTarget = label ?? directoryButton.current
      focusTarget?.focus({ preventScroll: true })
    }
    if (panelOpen && window.matchMedia('(max-width: 900px)').matches) {
      panelRef.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    }
    previousSelection.current = selectedAgentId
  }, [selectedAgentId, directoryOpen, panelOpen])

  function clearFilters() {
    setSelectedMemberId(null)
    setStatusFilter('all')
    setQuery('')
    setSelectedAgentId(null)
  }

  function selectMember(id: string | null) {
    setSelectedMemberId(id)
    setSelectedAgentId(null)
    setQuery('')
  }

  function changeTeam(id: string) {
    if (id === team.id) return
    setTeamId(id)
    clearFilters()
    setAvailability('loading')
    setResetKey((value) => value + 1)
    closeDialog()
  }

  function closeDialog() {
    copyAttempt.current++
    setDialogView(null)
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

  function changeStatus(value: StatusFilter) { setStatusFilter(value); setSelectedAgentId(null) }
  function toggleDirectory() { setSelectedAgentId(null); setDirectoryOpen((value) => !value) }

  return <div className="team-observatory">
    <PageTitle title="3D 팀 스페이스 - 2" />
    <header className="tp2-header">
      <a className="tp2-brand" href="/" aria-label="DevLink 워크스페이스"><BrandLogo /></a>
      <span className="tp2-page-name">팀 스페이스 <span>2</span></span>
      <nav aria-label="스페이스 페이지"><a href="/?preview=agents">스페이스 1</a><a href="/?preview=agents-3">스페이스 3</a><a href="/?preview=team">디자인 갤러리</a><button type="button" onClick={() => setDialogView('invite')}>팀원 초대<Icon name="plus" size={15} /></button></nav>
    </header>

    <main className={`tp2-stage ${panelOpen ? 'has-panel' : ''}`} aria-label="팀 연결 공간">
      <div className="obs-canvas">
        <ObservatoryScene team={team} selectedAgentId={selectedAgentId} selectedMemberId={selectedMemberId} visibleAgentIds={visibleAgentIds} onSelectAgent={onSelectAgent} paused={paused} view={view} resetKey={resetKey} panelOpen={panelOpen} onAvailabilityChange={onAvailabilityChange} />
        {availability === 'loading' && <div className="tp2-loading" role="status"><span />연결도를 준비하는 중</div>}
        {availability === 'unavailable' && <div className="tp2-fallback"><h2>팀 연결 목록</h2><p>현재 환경에서는 목록으로 살펴볼 수 있습니다.</p>{visibleEntries.map(({ agent, member }) => <button key={agent.id} onClick={() => onSelectAgent(agent.id)} type="button"><span>{String(entries.findIndex((item) => item.agent.id === agent.id) + 1).padStart(2, '0')}</span><strong>{agent.name}</strong><span>{member.name}</span><Signal online={agent.online} /></button>)}</div>}
      </div>

      <section className="tp2-context" aria-label="현재 팀">
        <span className="tp2-context-label">현재 팀</span>
        <div className="tp2-team-picker"><h1>{team.name}</h1><Icon name="chevron" size={16} /><select value={team.id} onChange={(event) => changeTeam(event.target.value)} aria-label="살펴볼 팀 선택">{immersivePreviewTeams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        <p>팀원 {team.members.length}명<span>/</span>에이전트 {entries.length}개</p>
      </section>

      <section className="tp2-roster" aria-labelledby="tp2-roster-title">
        <header><h2 id="tp2-roster-title">팀원</h2><span>온라인 / 전체</span></header>
        <div role="group" aria-label="팀원별 에이전트 필터">{team.members.map((member, index) => <button type="button" key={member.id} className={selectedMemberId === member.id ? 'is-active' : ''} onClick={() => selectMember(selectedMemberId === member.id ? null : member.id)} aria-pressed={selectedMemberId === member.id}><span className="tp2-member-index">{String(index + 1).padStart(2, '0')}</span><span className="tp2-member-name">{member.name}{member.role === 'OWNER' && <small>소유자</small>}</span><span className="tp2-member-count">{member.agents.filter((agent) => agent.online).length}<i>/</i>{member.agents.length}</span></button>)}</div>
        {(selectedMember || statusFilter !== 'all' || query) && <button type="button" className="tp2-clear-filter" onClick={clearFilters}>전체 연결 보기<Icon name="close" size={13} /></button>}
      </section>

      <div className="tp2-stage-note"><span>{selectedMember ? `${selectedMember.name}의 에이전트` : '팀원별 소유 관계'}</span><span>{visibleEntries.length} / {entries.length}개 표시</span></div>

      {panelOpen && <aside ref={panelRef} className="tp2-panel" aria-label="에이전트 탐색 및 상세 정보">
        <div className="tp2-panel-top"><span>{selected ? `에이전트 ${String(entries.findIndex(({ agent }) => agent.id === selected.agent.id) + 1).padStart(2, '0')}` : '에이전트 목록'}</span><button type="button" onClick={() => { setSelectedAgentId(null); setDirectoryOpen(false); directoryButton.current?.focus({ preventScroll: true }) }} aria-label="정보 패널 닫기"><Icon name="close" size={19} /></button></div>
        {selected ? <div className="tp2-detail" key={selected.agent.id}>
          <Signal online={selected.agent.online} />
          <h2 ref={detailTitle} tabIndex={-1}>{selected.agent.name}</h2>
          <p className="tp2-description">{selected.agent.description}</p>
          <dl className="tp2-agent-meta"><div><dt>도구</dt><dd>{selected.agent.tool}</dd></div><div><dt>프로젝트</dt><dd>{selected.agent.project}</dd></div><div><dt>소속 팀</dt><dd>{team.name}</dd></div></dl>
          <section className="tp2-owner"><h3>소유 팀원</h3><div><strong>{selected.member.name}</strong><span>{selected.member.role === 'OWNER' ? '팀 소유자' : '팀원'}</span></div><p>@{selected.member.nickname}</p><dl><div><dt>팀 참여일</dt><dd>{selected.member.joinedAt}</dd></div></dl><button type="button" onClick={() => { selectMember(selected.member.id); setStatusFilter('all'); setDirectoryOpen(true) }}>이 팀원의 에이전트 {selected.member.agents.length}개<Icon name="arrow" size={16} /></button></section>
          <div className="tp2-detail-nav"><button type="button" disabled={visibleEntries.length < 2} onClick={() => onSelectAgent(visibleEntries[(selectedIndex - 1 + visibleEntries.length) % visibleEntries.length].agent.id)} aria-label="이전 에이전트"><Icon name="arrow" size={16} />이전</button><button type="button" onClick={() => { setSelectedAgentId(null); setDirectoryOpen(true) }}>목록</button><button type="button" disabled={visibleEntries.length < 2} onClick={() => onSelectAgent(visibleEntries[(selectedIndex + 1) % visibleEntries.length].agent.id)} aria-label="다음 에이전트">다음<Icon name="arrow" size={16} /></button></div>
        </div> : <div className="tp2-directory">
          <h2>{selectedMember ? `${selectedMember.name}의 에이전트` : '에이전트 찾기'}<span>{visibleEntries.length}</span></h2>
          <label className="tp2-search"><ControlIcon name="search" /><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 팀원, 프로젝트" aria-label="에이전트 검색" />{query && <button type="button" onClick={() => setQuery('')} aria-label="검색어 지우기"><Icon name="close" size={14} /></button>}</label>
          <div className="tp2-status-filter" role="group" aria-label="에이전트 상태 필터">{([{ value: 'all', label: '전체' }, { value: 'online', label: '온라인' }, { value: 'offline', label: '오프라인' }] as const).map((item) => <button key={item.value} type="button" aria-pressed={statusFilter === item.value} className={statusFilter === item.value ? 'is-active' : ''} onClick={() => changeStatus(item.value)}>{item.label}</button>)}</div>
          <div className="tp2-agent-list" aria-label="에이전트 목록">{visibleEntries.length ? visibleEntries.map(({ agent, member }) => <button type="button" key={agent.id} onClick={() => onSelectAgent(agent.id)}><span className="tp2-list-index">{String(entries.findIndex((item) => item.agent.id === agent.id) + 1).padStart(2, '0')}</span><span><strong>{agent.name}</strong><small>{member.name}<i>/</i>{agent.project}</small></span><Signal online={agent.online} /></button>) : <div className="tp2-empty"><p>조건에 맞는 에이전트가 없습니다.</p><button type="button" onClick={() => { clearFilters(); searchRef.current?.focus() }}>필터 초기화</button></div>}</div>
        </div>}
      </aside>}
    </main>

    <footer className="tp2-footer">
      <div className="tp2-connection-status" role="group" aria-label="연결 상태 필터"><button type="button" className={statusFilter === 'online' ? 'is-active' : ''} aria-pressed={statusFilter === 'online'} onClick={() => changeStatus(statusFilter === 'online' ? 'all' : 'online')}><Signal online /><b>{onlineCount}</b></button><span>/</span><button type="button" className={statusFilter === 'offline' ? 'is-active' : ''} aria-pressed={statusFilter === 'offline'} onClick={() => changeStatus(statusFilter === 'offline' ? 'all' : 'offline')}><Signal online={false} /><b>{entries.length - onlineCount}</b></button></div>
      <div className="tp2-camera-controls" role="group" aria-label="공간 보기 조작"><button type="button" className={view === 'orbit' ? 'is-active' : ''} aria-pressed={view === 'orbit'} onClick={() => setView('orbit')}><ControlIcon name="perspective" />입체</button><button type="button" className={view === 'top' ? 'is-active' : ''} aria-pressed={view === 'top'} onClick={() => setView('top')}><ControlIcon name="plan" />평면</button><span /><button type="button" onClick={() => { setResetKey((value) => value + 1); setSelectedAgentId(null); setView('orbit') }} aria-label="처음 시점으로" title="처음 시점으로"><Icon name="refresh" size={17} /></button><button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? '공간 전환 애니메이션 켜기' : '공간 전환 애니메이션 끄기'} aria-pressed={paused} title={paused ? '전환 애니메이션 켜기' : '전환 애니메이션 끄기'}><ControlIcon name={paused ? 'play' : 'pause'} /></button></div>
      <button type="button" ref={directoryButton} className="tp2-directory-trigger" onClick={toggleDirectory} aria-expanded={directoryOpen}><ControlIcon name="search" />목록 · 검색<kbd>⌘ K</kbd></button>
    </footer>
    <div className="tp2-colophon"><span>3D 팀 스페이스 - 2<span>/</span>샘플 데이터<span>/</span>프로젝트 {projectCount}개</span><span>드래그 회전 · 휠 확대<button type="button" onClick={() => setDialogView('help')}>조작 방법</button></span></div>

    <dialog ref={dialogRef} className="tp2-dialog" aria-labelledby="tp2-dialog-title" onCancel={(event) => { event.preventDefault(); closeDialog() }} onClick={(event) => { if (event.target === event.currentTarget) closeDialog() }}>
      <header><span>{dialogView === 'invite' ? team.name : '팀 연결도'}</span><button type="button" onClick={closeDialog} aria-label="안내 닫기"><Icon name="close" /></button></header>
      <h2 id="tp2-dialog-title">{dialogView === 'invite' ? '팀원 초대' : '공간 살펴보기'}</h2>
      {dialogView === 'invite' ? <><label className="tp2-invite-code">초대 코드<input value={team.inviteCode} readOnly onFocus={(event) => event.currentTarget.select()} /></label><button className="tp2-primary" type="button" onClick={() => { void copyInvite() }}><Icon name={copyStatus === 'copied' ? 'check' : 'copy'} size={17} />{copyStatus === 'copied' ? '복사 완료' : '초대 코드 복사'}</button><p role="status">{copyStatus === 'error' ? '코드를 선택해 직접 복사해 주세요.' : '미리보기용 코드입니다. 실제 팀에는 연결되지 않습니다.'}</p></> : <><dl className="tp2-help"><div><dt>관계 읽기</dt><dd>각 자리는 한 팀원을 나타냅니다. 같은 자리에 놓인 모듈은 그 팀원이 소유한 에이전트입니다.</dd></div><div><dt>상태 확인</dt><dd>이름표와 모듈의 표시등으로 온라인·오프라인을 구분합니다. 하단의 상태를 누르면 해당 연결만 강조합니다.</dd></div><div><dt>상세 보기</dt><dd>모듈이나 이름표를 선택하세요. 팀원 이름으로 범위를 좁히거나 목록에서 검색할 수도 있습니다.</dd></div><div><dt>시점 조작</dt><dd>드래그로 회전, 휠로 확대합니다. 평면 보기와 시점 복귀는 하단에 있습니다.</dd></div></dl><div className="tp2-shortcuts"><span><kbd>Esc</kbd>정보 닫기</span><span><kbd>Ctrl / ⌘ K</kbd>검색</span></div><p>팀 생성일 {team.createdAt}. 샘플 데이터이며 실제 연결 상태는 반영하지 않습니다.</p></>}
    </dialog>
  </div>
}
