import { useState } from 'react'
import type { User } from '../features/auth/types'
import { useSession } from '../features/auth/hooks/useSession'
import { useWorkspace } from '../features/workspace/hooks/useWorkspace'
import StatCard from '../features/workspace/components/StatCard'
import TeamsPanel from '../features/teams/components/TeamsPanel'
import AgentsPanel from '../features/agents/components/AgentsPanel'
import { EmptyState, Icon } from '../components/ui'
import DashboardLayout from '../layouts/DashboardLayout'
import type { WorkspaceView } from '../layouts/DashboardLayout'
import { useNotice } from '../hooks/useNotice'
import GuidePage from './GuidePage'

export default function WorkspacePage({ user }: { user: User }) {
  const [view, setView] = useState<WorkspaceView>('workspace')
  const { onError } = useSession()
  const notify = useNotice()
  const workspace = useWorkspace(user.userId)
  const { teams, selectedTeamId, selectedTeam, members, agents, teamsLoading,
    workspaceLoading, workspaceError, selectTeam, refreshAll, refreshWorkspace } = workspace
  const statisticsReady = selectedTeam !== null && !workspaceLoading && !workspaceError

  return <DashboardLayout view={view} onViewChange={setView} teams={teams} selectedTeamId={selectedTeamId}
    teamsLoading={teamsLoading} workspaceLoading={workspaceLoading} onSelectTeam={selectTeam} onRefresh={refreshAll}>
    {view === 'guide' ? <GuidePage /> : <>
      <div className="page-heading"><div><h1>팀과 Agent를 한곳에서<span className="heading-dot">.</span></h1></div><span className="page-stamp"><Icon name="team" size={20} />{user.name}님의 워크스페이스</span></div>
      <div className="grid grid-cols-3 gap-4 mb-[26px] max-[720px]:gap-[9px] max-[720px]:mb-5">
        <StatCard label="참여 중인 팀" value={teamsLoading ? '—' : teams.length} caption="함께 개발하는 공간" icon="team" />
        <StatCard label="현재 팀의 Agent" value={statisticsReady ? agents.length : '—'} caption={selectedTeam?.name ?? '팀을 먼저 선택해주세요'} icon="agent" />
        <StatCard label="온라인 Agent" value={statisticsReady ? agents.filter((agent) => agent.status === 'ONLINE').length : '—'} caption="서버에 보고된 접속 상태" icon="shield" online />
      </div>
      <TeamsPanel teams={teams} selectedTeam={selectedTeam} members={members} currentUserId={user.userId}
        loading={teamsLoading || workspaceLoading} onSelectTeam={selectTeam} onTeamsChanged={selectTeam}
        onRefresh={refreshAll} onError={onError} onNotice={notify} />
      {workspaceError && <div className="workspace-error" role="alert"><Icon name="shield" /><p>{workspaceError}</p><button type="button" className="button button-secondary button-small" onClick={refreshAll}>다시 불러오기</button></div>}
      {selectedTeam ? <AgentsPanel key={selectedTeam.teamId} team={selectedTeam} agents={agents} members={members}
        currentUserId={user.userId} loading={workspaceLoading || !!workspaceError}
        onRefresh={refreshWorkspace} onError={onError} onNotice={notify} />
        : <section className="panel"><EmptyState title={teamsLoading ? '팀 정보를 불러오고 있어요' : '첫 번째 팀을 준비해보세요'} description="팀을 만들거나 초대 코드로 참여하면, 이곳에서 팀의 Agent를 관리할 수 있어요." icon={<Icon name="team" size={28} />} /></section>}
      <footer className="page-footer"><span>DevLink Workspace</span><span>팀 · 멤버 · Agent 관리</span></footer>
    </>}
  </DashboardLayout>
}
