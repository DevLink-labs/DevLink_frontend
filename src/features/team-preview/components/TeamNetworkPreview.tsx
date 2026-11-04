import { useCallback, useEffect, useRef, useState } from 'react'
import PageTitle from '../../../components/common/PageTitle'
import { Icon } from '../../../components/ui'
import { immersivePreviewTeams } from '../data/immersivePreviewData'
import { getDemoExchanges, getNetworkEntries } from '../data/networkPreviewData'
import NetworkTeamScene from './NetworkTeamScene'
import '../styles/TeamNetworkPreview.css'

type NetworkFilter = 'all' | 'online' | 'offline'
type NetworkDialog = 'agents' | 'help' | null

function ExchangeIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h16M14 6l6 6-6 6" /></svg>
}

function MotionIcon({ paused }: { paused: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paused ? <path d="m8 5 11 7-11 7V5Z" /> : <path d="M8 5v14M16 5v14" />}</svg>
}

function NetworkStatus({ online }: { online: boolean }) {
  return <span className={`nt-status ${online ? 'is-online' : 'is-offline'}`}><i aria-hidden="true" />{online ? '온라인' : '오프라인'}</span>
}

export default function TeamNetworkPreview() {
  const [teamId, setTeamId] = useState(immersivePreviewTeams[0].id)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [focusedPairId, setFocusedPairId] = useState<string | null>(null)
  const [filter, setFilter] = useState<NetworkFilter>('all')
  const [exchangeOpen, setExchangeOpen] = useState(false)
  const [dialog, setDialog] = useState<NetworkDialog>(null)
  const [query, setQuery] = useState('')
  const [paused, setPaused] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [view, setView] = useState<'space' | 'plan'>('space')
  const [resetKey, setResetKey] = useState(0)
  const [availability, setAvailability] = useState<'loading' | 'ready' | 'unavailable'>('loading')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const detailRef = useRef<HTMLElement>(null)
  const detailTitle = useRef<HTMLHeadingElement>(null)
  const listTrigger = useRef<HTMLButtonElement>(null)
  const exchangeTrigger = useRef<HTMLButtonElement>(null)
  const team = immersivePreviewTeams.find((item) => item.id === teamId) ?? immersivePreviewTeams[0]
  const entries = getNetworkEntries(team)
  const exchanges = getDemoExchanges(team)
  const onlineCount = entries.filter(({ agent }) => agent.online).length
  const visibleEntries = entries.filter(({ agent, member }) => (filter === 'all' || agent.online === (filter === 'online'))
    && `${agent.name} ${agent.project} ${agent.tool} ${member.name}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const selected = entries.find(({ agent }) => agent.id === selectedAgentId)
  const selectedExchanges = exchanges.filter((pair) => pair.fromId === selectedAgentId || pair.toId === selectedAgentId)
  const selectedIndex = visibleEntries.findIndex(({ agent }) => agent.id === selectedAgentId)
  const onSelectAgent = useCallback((id: string) => {
    setSelectedAgentId(id)
    setFocusedPairId(null)
    setExchangeOpen(false)
    setDialog(null)
  }, [])
  const onAvailabilityChange = useCallback((available: boolean) => setAvailability(available ? 'ready' : 'unavailable'), [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = (event: MediaQueryListEvent) => setPaused(event.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])

  useEffect(() => {
    const element = dialogRef.current
    if (dialog && !element?.open) element?.showModal()
    else if (!dialog && element?.open) element.close()
    return () => { if (element?.open) element.close() }
  }, [dialog])

  useEffect(() => {
    if (!selectedAgentId) return
    detailTitle.current?.focus({ preventScroll: true })
    if (window.matchMedia('(max-width: 1000px)').matches) {
      detailRef.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }, [selectedAgentId])

  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (dialog) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
        event.preventDefault()
        setSelectedAgentId(null)
        setDialog('agents')
      }
      if (event.key === 'Escape') {
        if (exchangeOpen) {
          setExchangeOpen(false)
          exchangeTrigger.current?.focus({ preventScroll: true })
        } else if (selectedAgentId) {
          const label = document.querySelector<HTMLButtonElement>(`.nts-agent-label[data-agent-id="${selectedAgentId}"]:not([hidden])`)
          setSelectedAgentId(null)
          const focusTarget = label ?? listTrigger.current
          focusTarget?.focus({ preventScroll: true })
        } else setFocusedPairId(null)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [dialog, selectedAgentId, exchangeOpen])

  function changeTeam(id: string) {
    if (id === team.id) return
    setTeamId(id)
    setSelectedAgentId(null)
    setFocusedPairId(null)
    setFilter('all')
    setQuery('')
    setExchangeOpen(false)
    setDialog(null)
    setAvailability('loading')
    setResetKey((value) => value + 1)
  }

  function changeFilter(value: NetworkFilter) {
    setFilter(value)
    setSelectedAgentId(null)
    setFocusedPairId(null)
    setQuery('')
  }

  function focusPair(id: string) {
    setFocusedPairId(focusedPairId === id ? null : id)
    setSelectedAgentId(null)
    setFilter('all')
    setQuery('')
  }

  function closeDialog() {
    dialogRef.current?.close()
    setDialog(null)
    if (dialog === 'agents') listTrigger.current?.focus({ preventScroll: true })
  }

  function closeDetail() {
    const label = document.querySelector<HTMLButtonElement>(`.nts-agent-label[data-agent-id="${selectedAgentId}"]:not([hidden])`)
    setSelectedAgentId(null)
    const focusTarget = label ?? listTrigger.current
    focusTarget?.focus({ preventScroll: true })
  }

  function resetOverview() {
    setFilter('all')
    setQuery('')
    setSelectedAgentId(null)
    setFocusedPairId(null)
    setView('space')
    setResetKey((value) => value + 1)
  }

  return <div className="team-network-preview">
    <PageTitle title="3D 팀 스페이스 - 3" />
    <header className="nt-header"><a className="nt-brand" href="/" aria-label="DevLink 워크스페이스">DevLink</a><nav aria-label="3D 스페이스 선택"><a href="/?preview=agents" aria-label="3D 팀 스페이스 열기">스페이스 1</a><a href="/?preview=agents-2" aria-label="3D 팀 스페이스 - 2 열기">스페이스 2</a><a href="/?preview=agents-3" aria-current="page">스페이스 3</a></nav><button ref={listTrigger} type="button" className="nt-list-trigger" onClick={() => { setSelectedAgentId(null); setDialog('agents') }}><Icon name="team" size={19} />에이전트 목록</button></header>

    <main>
      <section className="nt-intro" aria-label="전체 팀 현황"><div><div className="nt-team-picker"><h1>{team.name}</h1><Icon name="chevron" size={20} /><select aria-label="살펴볼 팀 선택" value={team.id} onChange={(event) => changeTeam(event.target.value)}>{immersivePreviewTeams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><p>팀원 {team.members.length}명<span>·</span>에이전트 {entries.length}개</p></div><div className="nt-counts" role="group" aria-label="연결 상태 필터"><button type="button" className={filter === 'online' ? 'is-active' : ''} aria-pressed={filter === 'online'} onClick={() => changeFilter(filter === 'online' ? 'all' : 'online')}><strong>{onlineCount}</strong><NetworkStatus online /></button><button type="button" className={filter === 'offline' ? 'is-active' : ''} aria-pressed={filter === 'offline'} onClick={() => changeFilter(filter === 'offline' ? 'all' : 'offline')}><strong>{entries.length - onlineCount}</strong><NetworkStatus online={false} /></button></div></section>

      <section className={`nt-stage ${selected ? 'has-detail' : ''}`} aria-label="에이전트 연결 공간">
        <div className="nt-canvas"><NetworkTeamScene team={team} selectedAgentId={selectedAgentId} focusedPairId={focusedPairId} visibleAgentIds={visibleEntries.map(({ agent }) => agent.id)} onSelectAgent={onSelectAgent} paused={paused} view={view} resetKey={resetKey} panelOpen={!!selected} onAvailabilityChange={onAvailabilityChange} />
          {availability === 'loading' && <div className="nt-loading" role="status"><span />연결 공간을 준비하고 있어요.</div>}
          {availability === 'unavailable' && <div className="nt-fallback"><h2>에이전트 연결</h2><p>현재 환경에서는 목록으로 탐색할 수 있습니다.</p>{visibleEntries.map(({ agent, member }) => <button key={agent.id} type="button" onClick={() => onSelectAgent(agent.id)}><strong>{agent.name}</strong><span>{member.name}</span><NetworkStatus online={agent.online} /></button>)}</div>}
        </div>
        {(filter !== 'all' || query || focusedPairId) && <button className="nt-overview" type="button" onClick={resetOverview}><Icon name="arrow" size={17} />전체 연결 보기</button>}
        {selected && <aside ref={detailRef} className="nt-detail" aria-label="에이전트 상세 정보" key={selected.agent.id}>
          <header><NetworkStatus online={selected.agent.online} /><button type="button" className="nt-icon-button" onClick={closeDetail} aria-label="에이전트 정보 닫기"><Icon name="close" size={22} /></button></header>
          <h2 ref={detailTitle} tabIndex={-1}>{selected.agent.name}</h2><p className="nt-agent-description">{selected.agent.description}</p>
          <dl className="nt-agent-facts"><div><dt>도구</dt><dd>{selected.agent.tool}</dd></div><div><dt>프로젝트</dt><dd>{selected.agent.project}</dd></div><div><dt>담당 팀원</dt><dd>{selected.member.name}</dd></div></dl>
          {selectedExchanges.length > 0 ? <section className="nt-agent-exchange"><h3><ExchangeIcon size={18} />{selectedExchanges[0].fromId === selectedAgentId ? '데모 송신' : '데모 수신'}</h3>{selectedExchanges.map((pair) => {
            const other = entries.find(({ agent }) => agent.id === (pair.fromId === selectedAgentId ? pair.toId : pair.fromId))!
            return <button key={pair.id} type="button" onClick={() => { setQuery(''); setFilter('all'); onSelectAgent(other.agent.id) }}><span><strong>{other.agent.name}</strong><small>{pair.fromId === selectedAgentId ? '보내는 대상' : '보낸 에이전트'} · {pair.label}</small></span><Icon name="chevron" size={20} /></button>
          })}<p>{paused ? '통신 애니메이션이 일시정지되어 있습니다.' : '송신 에이전트에서 수신 에이전트로만 데이터를 보내는 데모입니다.'}</p></section> : <p className="nt-no-exchange">{selected.agent.online ? '현재 설정된 데모 통신 상대가 없습니다.' : '오프라인 에이전트는 데모 통신에 참여하지 않습니다.'}</p>}
          <details className="nt-member-more"><summary>팀원 정보</summary><dl><div><dt>닉네임</dt><dd>@{selected.member.nickname}</dd></div><div><dt>팀 권한</dt><dd>{selected.member.role === 'OWNER' ? '팀 소유자' : '팀원'}</dd></div><div><dt>참여일</dt><dd>{selected.member.joinedAt}</dd></div></dl></details>
          <footer><button type="button" disabled={visibleEntries.length < 2} onClick={() => onSelectAgent(visibleEntries[(selectedIndex - 1 + visibleEntries.length) % visibleEntries.length].agent.id)} aria-label="이전 에이전트"><Icon name="arrow" size={17} />이전</button><button type="button" onClick={() => { setSelectedAgentId(null); setDialog('agents') }}>목록</button><button type="button" disabled={visibleEntries.length < 2} onClick={() => onSelectAgent(visibleEntries[(selectedIndex + 1) % visibleEntries.length].agent.id)} aria-label="다음 에이전트">다음<Icon name="arrow" size={17} /></button></footer>
        </aside>}
      </section>
    </main>

    <footer className="nt-toolbar"><div className="nt-view-controls" role="group" aria-label="공간 보기"><button type="button" aria-pressed={view === 'space'} className={view === 'space' ? 'is-active' : ''} onClick={() => setView('space')}>입체</button><button type="button" aria-pressed={view === 'plan'} className={view === 'plan' ? 'is-active' : ''} onClick={() => setView('plan')}>평면</button><button type="button" className="nt-icon-button" onClick={resetOverview} aria-label="처음 시점으로" title="처음 시점으로"><Icon name="refresh" size={20} /></button></div>
      <div className="nt-exchange-control"><button ref={exchangeTrigger} className="nt-exchange-trigger" type="button" aria-expanded={exchangeOpen} aria-controls="nt-exchanges" onClick={() => setExchangeOpen((value) => !value)}><ExchangeIcon /><span>데모 전송 <b>{exchanges.length}개</b></span><Icon name="chevron" size={15} /></button>{exchangeOpen && <section id="nt-exchanges" className="nt-exchanges" aria-label="데모 전송 경로"><header><h2>데모 전송 경로</h2><button type="button" className="nt-icon-button" onClick={() => { setExchangeOpen(false); exchangeTrigger.current?.focus() }} aria-label="통신 연결 닫기"><Icon name="close" size={19} /></button></header><p>각 전송은 송신 에이전트에서 수신 에이전트로만 흐릅니다.</p>{exchanges.map((pair, index) => <button key={pair.id} type="button" className={focusedPairId === pair.id ? 'is-active' : ''} aria-pressed={focusedPairId === pair.id} aria-label={`${entries.find(({ agent }) => agent.id === pair.fromId)?.agent.name}에서 ${entries.find(({ agent }) => agent.id === pair.toId)?.agent.name}로 ${pair.label}`} onClick={() => focusPair(pair.id)}><i className={`nt-pair-color nt-pair-${index}`} aria-hidden="true" /><span><strong>{entries.find(({ agent }) => agent.id === pair.fromId)?.agent.name}<ExchangeIcon size={16} />{entries.find(({ agent }) => agent.id === pair.toId)?.agent.name}</strong><small>{pair.label}</small></span></button>)}<span className="nt-exchange-state">{paused ? '일시정지 · 경로만 표시 중' : '빛이 화살표 방향으로만 흐릅니다.'}</span></section>}</div>
      <div className="nt-motion-controls"><span>드래그 회전 · 휠 확대</span><button type="button" className="nt-icon-button" aria-pressed={paused} onClick={() => setPaused((value) => !value)} aria-label={paused ? '통신 애니메이션 재생' : '통신 애니메이션 일시정지'} title={paused ? '통신 애니메이션 재생' : '통신 애니메이션 일시정지'}><MotionIcon paused={paused} /></button><button type="button" className="nt-help-button" onClick={() => setDialog('help')}>도움말</button></div>
    </footer>
    <p className="nt-demo-note">샘플 팀 데이터 · 연결 구조와 통신 효과는 시뮬레이션입니다.</p>

    <dialog className="nt-dialog" ref={dialogRef} aria-labelledby="nt-dialog-title" onCancel={(event) => { event.preventDefault(); closeDialog() }} onClick={(event) => { if (event.target === event.currentTarget) closeDialog() }}><header><h2 id="nt-dialog-title">{dialog === 'agents' ? '에이전트 목록' : '연결 공간 살펴보기'}</h2><button type="button" className="nt-icon-button" onClick={closeDialog} aria-label="창 닫기"><Icon name="close" size={22} /></button></header>{dialog === 'agents' ? <><input className="nt-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="이름, 팀원, 프로젝트 검색" aria-label="에이전트 검색" /><div className="nt-list-filters" role="group" aria-label="목록 연결 상태">{([{ id: 'all', text: '전체' }, { id: 'online', text: '온라인' }, { id: 'offline', text: '오프라인' }] as const).map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} className={filter === item.id ? 'is-active' : ''} onClick={() => changeFilter(item.id)}>{item.text}</button>)}</div><div className="nt-agent-list">{visibleEntries.length ? visibleEntries.map(({ agent, member }) => <button key={agent.id} type="button" onClick={() => onSelectAgent(agent.id)}><span><strong>{agent.name}</strong><small>{member.name} · {agent.tool}</small></span><NetworkStatus online={agent.online} /><Icon name="chevron" size={18} /></button>) : <div className="nt-empty"><p>조건에 맞는 에이전트가 없습니다.</p><button type="button" onClick={() => { setQuery(''); setFilter('all') }}>전체 에이전트 보기</button></div>}</div></> : <div className="nt-help"><p><strong>맑은 유리 형태는 온라인, 흐린 유리 형태는 오프라인입니다.</strong> 상태 표시와 에이전트를 선택했을 때 나오는 정보로도 구분할 수 있습니다.</p><p>에이전트나 이름표를 선택하면 도구, 프로젝트, 담당 팀원과 데모 송신·수신 정보를 확인할 수 있습니다.</p><p>가는 선은 샘플 연결입니다. 색이 있는 선의 화살표와 흐르는 빛은 한 에이전트에서 다른 에이전트로 보내는 단방향 데모 전송입니다.</p><p>애니메이션을 멈춰도 에이전트를 선택하거나 공간을 둘러볼 수 있습니다.</p><div><kbd>Esc</kbd> 정보 닫기 <kbd>Ctrl / ⌘ K</kbd> 목록 검색</div></div>}</dialog>
  </div>
}
