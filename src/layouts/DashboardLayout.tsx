import type { ReactNode } from 'react'
import PageTitle from "@/components/common/PageTitle";
import TeamSpaceLink from "@/components/common/TeamSpaceLink";
import { Icon } from "@/components/ui";
import { useSession } from "@/features/auth/hooks/useSession";
import type { Team } from "@/features/teams/types";
import { API_BASE_URL } from "@/lib/apiClient";

export type WorkspaceView = 'workspace' | 'guide'

interface DashboardLayoutProps {
  children: ReactNode
  view: WorkspaceView
  onViewChange: (view: WorkspaceView) => void
  teams: Team[]
  selectedTeamId: number | null
  teamsLoading: boolean
  workspaceLoading: boolean
  onSelectTeam: (teamId: number) => void
  onRefresh: () => void
  onReturnToScene: () => void;
}

export default function DashboardLayout({
  children, view, onViewChange, teams, selectedTeamId, teamsLoading,
  workspaceLoading, onSelectTeam, onRefresh, onReturnToScene,
}: DashboardLayoutProps) {
  const { user, connection, loggingOut, logout } = useSession()
  if (!user) return null

  return <div className="app-shell min-h-screen">
    <PageTitle title={view === 'workspace' ? '팀과 Agent' : '사용 가이드'} />
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="DevLink 홈"><span className="brand-symbol">D</span><span>DevLink</span></a>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="주 메뉴">
        <button type="button" className={view === 'workspace' ? 'nav-item active' : 'nav-item'} onClick={() => onViewChange('workspace')} aria-current={view === 'workspace' ? 'page' : undefined}><Icon name="grid" />팀과 Agent</button>
        <button type="button" className={view === 'guide' ? 'nav-item active' : 'nav-item'} onClick={() => onViewChange('guide')} aria-current={view === 'guide' ? 'page' : undefined}><Icon name="book" />사용 가이드</button>
        <a className="nav-item" href="/?preview=team" aria-label="팀 디자인 미리보기" title="팀 디자인 미리보기"><Icon name="eye" />팀 디자인 미리보기</a>
        <button type="button" className="nav-item" onClick={onReturnToScene} aria-label="3D 팀 스페이스" title="3D 팀 스페이스"><Icon name="team" />3D 팀 스페이스</button>
        <TeamSpaceLink variant="navigation" className="nav-item" edition={2} />
        <TeamSpaceLink variant="navigation" className="nav-item" edition={3} />
      </nav>
      <div className="sidebar-divider" />
      <div className="sidebar-team-heading"><span>내 팀</span><span>{teamsLoading ? '…' : teams.length}</span></div>
      <div className="sidebar-teams">
        {teams.map((team) => <button className={selectedTeamId === team.teamId ? 'team-nav-item selected' : 'team-nav-item'} key={team.teamId} type="button" onClick={() => { onSelectTeam(team.teamId); onViewChange('workspace') }}>
          <span className="team-letter">{team.name.slice(0, 1)}</span><span className="team-nav-name">{team.name}</span><Icon name="chevron" size={14} /></button>)}
        {!teamsLoading && teams.length === 0 && <p className="sidebar-empty">팀을 만들거나<br />초대 코드로 참여해보세요.</p>}
      </div>
      <div className="sidebar-bottom"><div className="sidebar-profile">
        <span className="avatar">{(user.nickname || user.name).slice(0, 1)}</span>
        <div><strong>{user.nickname || user.name}</strong><span title={user.email}>{user.email}</span></div>
        <button type="button" className="icon-button" onClick={logout} disabled={loggingOut} aria-label={loggingOut ? '로그아웃 처리 중' : '로그아웃'} title="로그아웃"><Icon name="logout" size={19} /></button>
      </div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar">
        <div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={13} /><strong>{view === 'workspace' ? '팀과 Agent' : '사용 가이드'}</strong></div>
        <div className="topbar-actions">
          {connection !== 'online' && <span className={`connection-indicator connection-${connection}`} title={API_BASE_URL || '로컬 개발 프록시'} role="status"><span className="status-dot" />{connection === 'checking' ? '확인 중' : '연결 확인 필요'}</span>}
          <button type="button" className="icon-button" onClick={onRefresh} aria-label="전체 새로고침" title="전체 새로고침" disabled={teamsLoading || workspaceLoading}><Icon name="refresh" size={18} /></button>
        </div>
      </header>
      <main className="workspace-main">{children}</main>
    </div>
  </div>
}
