import { useTranslation } from "@/lib/i18n";
import BrandLogo from "@/components/common/BrandLogo";
import { useId, useState } from 'react'
import { Icon } from '../../../components/ui'
import type { PreviewTeam } from '../data/previewData'
import '../styles/TeamWorkspaceDashboard.css'

interface TeamWorkspaceDashboardProps {
  team: PreviewTeam
  teams: PreviewTeam[]
  selectedMemberId: string
  onSelectTeam: (id: string) => void
  onSelectMember: (id: string) => void
  onFocusMember: (id: string) => void
  onInvite: () => void
  onReturnToScene: () => void
}

const toolNames = { Codex: '코덱스', 'Claude Code': '클로드 코드' }

export default function TeamWorkspaceDashboard({
  team, teams, selectedMemberId, onSelectTeam, onSelectMember, onFocusMember, onInvite, onReturnToScene,
}: TeamWorkspaceDashboardProps) {
  const { t } = useTranslation();
  const fieldId = useId()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'team' | 'member'>('team')
  const member = team.members.find((item) => item.id === selectedMemberId) ?? team.members[0]
  const owner = team.members.find((item) => item.role === 'OWNER')
  const agents = team.members.flatMap((item) => item.agents.map((agent) => ({ ...agent, owner: item })))
  const search = query.trim().toLocaleLowerCase()
  const visibleAgents = agents.filter((agent) =>
    (scope === 'team' || agent.owner.id === member?.id)
    && [agent.name, agent.project, agent.owner.name, t(toolNames[agent.tool])].some((value) => value.toLocaleLowerCase().includes(search)),
  )

  function changeTeam(id: string) {
    setQuery('')
    setScope('team')
    onSelectTeam(id)
  }

  return <div className="itd-dashboard">
    <aside className="itd-sidebar" aria-label={t("팀 메뉴")}>
      <a className="itd-brand" href="/" aria-label={t("DevLink 홈")}><BrandLogo tone="light" /></a>
      <div className="itd-sidebar-menu"><span className="itd-nav-active" aria-current="page"><Icon name="team" size={20} />{t("팀과 에이전트")}</span><button type="button" className="itd-scene-nav" onClick={onReturnToScene}><Icon name="agent" size={20} />{t("3D 팀 보기")}<Icon name="arrow" size={16} /></button></div>
      <div className="itd-sidebar-teams"><span>{t("참여 중인 팀")}</span>{teams.map((item) => <button key={item.id} type="button" className={item.id === team.id ? 'is-selected' : ''} aria-pressed={item.id === team.id} onClick={() => changeTeam(item.id)}><span>{item.name.slice(0, 1)}</span>{item.name}<Icon name="chevron" size={14} /></button>)}</div>
      <div className="itd-sidebar-footer"><Icon name="shield" size={19} /><span>{t("팀원과 에이전트를")}<br />{t("한곳에서 확인하세요.")}</span></div>
    </aside>

    <div className="itd-workspace">
      <header className="itd-topbar"><span>{t("팀과 에이전트")}</span><button type="button" className="itd-button itd-button-subtle" onClick={onReturnToScene}><Icon name="agent" size={17} />{t("3D로 보기")}<Icon name="arrow" size={16} /></button></header>
      <div className="itd-content">
        <div className="itd-page-heading"><div><h2>{team.name}</h2><p>{t("팀 구성과 에이전트 연결 상태를 확인하세요.")}</p></div><button type="button" className="itd-button itd-button-primary" onClick={onInvite}><Icon name="plus" size={18} />{t("팀원 초대")}</button></div>

        <div className="itd-stat-grid" aria-label={t("팀 현황")}>
          <div className="itd-stat"><div><span>{t("함께하는 팀원")}</span><strong>{team.members.length}<small>{t("명")}</small></strong></div><span className="itd-stat-icon"><Icon name="team" size={25} /></span></div>
          <div className="itd-stat"><div><span>{t("등록된 에이전트")}</span><strong>{agents.length}<small>{t("개")}</small></strong></div><span className="itd-stat-icon"><Icon name="agent" size={25} /></span></div>
          <div className="itd-stat"><div><span>{t("온라인 에이전트")}</span><strong>{agents.filter((agent) => agent.online).length}<small>{t("개")}</small></strong></div><span className="itd-stat-icon is-green"><Icon name="shield" size={25} /></span></div>
        </div>

        <section className="itd-panel itd-team-summary" aria-labelledby={`${fieldId}-team-heading`}>
          <div className="itd-summary-heading"><span className="itd-team-symbol"><Icon name="team" size={26} /></span><div><h3 id={`${fieldId}-team-heading`}>{t("팀 정보")}</h3><span>{team.name}</span></div></div>
          <dl className="itd-team-meta"><div><dt>{t("생성일")}</dt><dd>{team.createdAt}</dd></div><div><dt>{t("팀 소유자")}</dt><dd>{owner?.name ?? t("지정된 소유자 없음")}</dd></div></dl>
          <div className="itd-team-select"><label htmlFor={`${fieldId}-team`}>{t("현재 팀")}</label><select id={`${fieldId}-team`} value={team.id} onChange={(event) => changeTeam(event.target.value)}>{teams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
        </section>

        <div className="itd-members-layout">
          <section className="itd-panel itd-members-panel" aria-labelledby={`${fieldId}-members-heading`}>
            <div className="itd-panel-heading"><h3 id={`${fieldId}-members-heading`}>{t("팀원")}</h3><span className="itd-count">{team.members.length}{t("명")}</span></div>
            <div className="itd-member-list">{team.members.map((item) => <button key={item.id} type="button" className={`itd-member-row ${member?.id === item.id ? 'is-selected' : ''}`} aria-pressed={member?.id === item.id} onClick={() => onSelectMember(item.id)}><span className={`itd-avatar itd-color-${item.color}`} aria-hidden="true">{item.name.slice(-2)}</span><span className="itd-member-identity"><strong>{item.name}</strong><span>{t("에이전트 ")}{item.agents.length}{t("개")}</span></span><span className={`itd-role ${item.role === 'OWNER' ? 'is-owner' : ''}`}>{item.role === 'OWNER' ? t("소유자") : t("팀원")}</span><Icon name="chevron" size={15} /></button>)}</div>
          </section>

          {member && <section className="itd-panel itd-member-detail" aria-label={t("{{value0}} 상세 정보", { value0: member.name })}>
            <div className="itd-member-detail-heading"><span className={`itd-avatar itd-avatar-large itd-color-${member.color}`} aria-hidden="true">{member.name.slice(-2)}</span><div><h3>{member.name}</h3><span>{member.role === 'OWNER' ? t("팀 소유자") : t("팀원")}</span></div></div>
            <dl className="itd-member-meta"><div><dt>{t("팀 참여일")}</dt><dd>{member.joinedAt}</dd></div><div><dt>{t("등록된 에이전트")}</dt><dd>{member.agents.length}{t("개")}</dd></div></dl>
            <div className="itd-member-agents">{member.agents.map((agent) => <span key={agent.id}><Icon name="agent" size={15} />{agent.name}<i className={agent.online ? 'is-online' : ''} aria-label={agent.online ? t("온라인") : t("오프라인")} /></span>)}</div>
            <button type="button" className="itd-button itd-focus-member" onClick={() => onFocusMember(member.id)}><Icon name="eye" size={17} />{t("3D에서 보기")}<Icon name="arrow" size={16} /></button>
          </section>}
        </div>

        <section className="itd-panel itd-agents-panel" aria-labelledby={`${fieldId}-agents-heading`}>
          <div className="itd-panel-heading itd-agents-heading"><h3 id={`${fieldId}-agents-heading`}>{t("에이전트")}</h3><div className="itd-agent-scope" role="group" aria-label={t("에이전트 표시 범위")}><button type="button" className={scope === 'team' ? 'is-active' : ''} aria-pressed={scope === 'team'} onClick={() => setScope('team')}>{t("팀 전체")}</button><button type="button" className={scope === 'member' ? 'is-active' : ''} aria-pressed={scope === 'member'} onClick={() => setScope('member')}>{t("선택한 팀원")}</button></div></div>
          <div className="itd-agents-toolbar"><span aria-live="polite">{visibleAgents.length}{t("개 에이전트")}</span><div className="itd-search"><label htmlFor={`${fieldId}-search`} className="itd-sr-only">{t("에이전트, 프로젝트, 팀원 검색")}</label><input id={`${fieldId}-search`} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("에이전트, 프로젝트, 팀원 검색")} />{query && <button type="button" onClick={() => setQuery('')} aria-label={t("검색어 지우기")}><Icon name="close" size={16} /></button>}</div></div>
          <div className="itd-table-scroll"><table className="itd-agent-table"><thead><tr><th scope="col">{t("에이전트")}</th><th scope="col">{t("도구")}</th><th scope="col">{t("프로젝트")}</th><th scope="col">{t("팀원")}</th><th scope="col">{t("연결 상태")}</th></tr></thead><tbody>{visibleAgents.length > 0 ? visibleAgents.map((agent) => <tr key={agent.id}><td><span className="itd-agent-name"><span className="itd-agent-icon"><Icon name="agent" size={20} /></span><strong>{agent.name}</strong></span></td><td><span className="itd-tool">{t(toolNames[agent.tool])}</span></td><td>{agent.project}</td><td><button type="button" className="itd-owner-button" onClick={() => onSelectMember(agent.owner.id)}>{agent.owner.name}</button></td><td><span className={`itd-status ${agent.online ? 'is-online' : ''}`}><i />{agent.online ? t("온라인") : t("오프라인")}</span></td></tr>) : <tr><td colSpan={5} className="itd-empty">{t("검색 조건에 맞는 에이전트가 없습니다.")}</td></tr>}</tbody></table></div>
          <div className="itd-agents-note"><Icon name="shield" size={16} /><span>{t("연결 상태는 에이전트 기준으로 표시됩니다.")}</span></div>
        </section>
      </div>
    </div>
  </div>
}
