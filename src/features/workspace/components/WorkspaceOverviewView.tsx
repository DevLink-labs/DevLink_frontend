import { useRef, useState } from "react";
import type { Team, TeamMember } from "@/features/teams/types";
import type { Agent } from "@/features/agents/types";
import type { TaskListItem, TaskStatus } from "@/features/tasks/types";
import { formatTaskTime, taskStatusLabels, taskTitle } from "@/features/tasks/utils/taskPresentation";
import { EmptyState, Icon } from "@/components/ui";
import chatgptLogo from "@/assets/image/agent-logo/chatgpt.svg";
import claudeLogo from "@/assets/image/agent-logo/claude.svg";
import "../styles/workspace-overview.css";

interface WorkspaceOverviewViewProps {
  team: Team | null;
  members: TeamMember[];
  agents: Agent[];
  workspaceLoading: boolean;
  workspaceError: boolean;
  tasks: TaskListItem[];
  tasksLoading: boolean;
  tasksError: string | null;
  onSelectTask: (taskId: number) => void;
  onManageTeams: () => void;
  onManageAgents: () => void;
  onGuide: () => void;
  onInvite: () => void;
  onRetryTasks: () => void;
}

export default function WorkspaceOverviewView({
  team, members, agents, workspaceLoading,
  workspaceError, tasks, tasksLoading, tasksError, onSelectTask,
  onManageTeams, onManageAgents, onGuide, onInvite, onRetryTasks,
}: WorkspaceOverviewViewProps) {
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const taskScrollRef = useRef<HTMLDivElement>(null);
  const ready = team !== null && !workspaceLoading && !workspaceError;
  const onlineAgents = agents.filter((agent) => agent.status === "ONLINE");
  const tasksReady = team !== null && !tasksLoading && !tasksError;
  const pendingTasks = tasks.filter((task) => task.status === "PENDING");
  const pendingCaption = !team ? "팀을 선택하면 대기 요청을 확인할 수 있어요."
    : tasksError ? "요청 현황을 불러오지 못했어요."
      : tasksLoading ? "대기 요청을 확인하고 있어요."
        : pendingTasks.length > 0 ? "Agent의 수락을 기다리는 요청이 있어요." : "수락을 기다리는 요청이 없어요.";
  const visibleTasks = status === "all" ? tasks : tasks.filter((task) => task.status === status);
  const owners = new Map(members.map((member) => [member.userId, member.nickname || member.name]));
  const agentTools = new Map(agents.map((agent) => [agent.agentId, agent.toolType]));
  const sortedAgents = [...agents].sort((a, b) => Number(b.status === "ONLINE") - Number(a.status === "ONLINE"));

  function renderTaskAgentLogo(agentId: number) {
    const toolType = agentTools.get(agentId);
    return <span className="overview-task-agent-logo">
      {toolType ? <img src={toolType === "CODEX" ? chatgptLogo : claudeLogo} alt={toolType === "CODEX" ? "Codex" : "Claude Code"} width={18} height={18} />
        : <Icon name="agent" size={18} />}
    </span>;
  }

  function filterTasks(nextStatus: TaskStatus | "all") {
    setStatus(nextStatus);
    taskScrollRef.current?.scrollTo({ top: 0 });
  }

  return <div className="workspace-overview">
    <div className="overview-heading">
      <h1>대시보드</h1>
    </div>

    <div className="overview-primary-grid">
      <div className="overview-summary-grid">
        <section className="overview-summary-card overview-agent-summary" aria-labelledby="overview-agent-summary-title" aria-busy={workspaceLoading}>
          <div className="overview-summary-header">
            <h2 id="overview-agent-summary-title">팀 Agent</h2>
          </div>
          <dl className="overview-agent-metrics">
            <div><dt>전체 Agent</dt><dd>{ready ? agents.length : "—"}<span>개</span></dd></div>
            <div className="overview-online-metric"><dt>온라인 Agent</dt><dd>{ready ? onlineAgents.length : "—"}<span>개</span></dd></div>
          </dl>
          <div className="overview-summary-footer">
            <button type="button" className="overview-summary-action" onClick={onManageAgents} disabled={!team}>Agent 관리<Icon name="arrow" size={17} /></button>
          </div>
        </section>

        <section className="overview-summary-card overview-pending-summary" aria-labelledby="overview-pending-summary-title" aria-busy={tasksLoading}>
          <div className="overview-summary-header">
            <h2 id="overview-pending-summary-title">수락 대기 요청</h2>
          </div>
          <p className="overview-pending-caption">{pendingCaption}</p>
          <div className="overview-pending-bottom">
            <p className="overview-pending-value">
              {tasksReady ? pendingTasks.length : "—"}<span>건</span>
            </p>
            <button type="button" className="overview-summary-action" onClick={() => filterTasks("PENDING")} disabled={!tasksReady || pendingTasks.length === 0}>요청 확인하기<Icon name="arrow" size={17} /></button>
          </div>
        </section>
      </div>

      <section className="overview-content-card overview-task-panel" aria-labelledby="overview-conversations-title">
        <header className="overview-section-heading">
          <div className="overview-card-title">
            <div><h2 id="overview-conversations-title">최근 Agent 대화</h2><span className="overview-count">{tasksLoading ? "…" : tasks.length}</span></div>
            <p>작업 요청과 진행 상황</p>
          </div>
          <label className="overview-task-filter">
            <span className="sr-only">작업 상태 필터</span>
            <select value={status} onChange={(event) => filterTasks(event.target.value as TaskStatus | "all")}>
              <option value="all">모든 상태</option>
              {Object.entries(taskStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </header>
        <div className="overview-task-content">
          {tasksError ? <div className="overview-inline-error" role="alert"><Icon name="shield" /><div><strong>작업 기록을 불러오지 못했어요</strong><p>{tasksError}</p></div><button type="button" className="button button-secondary button-small" onClick={onRetryTasks}>다시 불러오기</button></div>
            : tasksLoading ? <div className="overview-loading" role="status">작업 기록을 불러오고 있어요<span className="loading-bar" /></div>
              : visibleTasks.length === 0 ? <EmptyState title={!team ? "팀 선택" : status === "all" ? "작업 기록 없음" : "해당 상태의 작업 없음"} description={!team ? "팀 관리에서 새 팀을 만들거나 초대 코드로 참여하세요." : undefined} icon={<Icon name="book" size={26} />} />
                : <div className="overview-table-scroll" ref={taskScrollRef} role="region" aria-label="Agent 대화 목록" tabIndex={0}>
                  <table className="overview-task-table">
                    <thead><tr><th scope="col">작업</th><th scope="col">참여 Agent</th><th scope="col">상태</th><th scope="col">최근 활동</th></tr></thead>
                    <tbody>{visibleTasks.map((task) => <tr key={task.taskId} className={task.status === "IN_PROGRESS" ? "is-in-progress" : undefined}>
                      <td>
                        <button
                          type="button"
                          className="overview-task-link"
                          aria-label={`${taskTitle(task)} 대화 열기`}
                          title={`${taskTitle(task)} · ${task.requesterAgent.name} → ${task.receiverAgent.name}`}
                          onClick={() => onSelectTask(task.taskId)}
                        >
                          <span className="overview-task-number">#{task.taskId}</span>
                          <strong>{taskTitle(task)}</strong>
                        </button>
                      </td>
                      <td>
                        <span className="overview-task-agents" title={`${task.requesterAgent.name} → ${task.receiverAgent.name}`}>
                          <span className="overview-task-agent">
                            {renderTaskAgentLogo(task.requesterAgent.agentId)}
                            <span>{task.requesterAgent.name}</span>
                          </span>
                          <span className="overview-task-direction" aria-hidden="true">→</span>
                          <span className="overview-task-agent">
                            {renderTaskAgentLogo(task.receiverAgent.agentId)}
                            <span>{task.receiverAgent.name}</span>
                          </span>
                        </span>
                      </td>
                      <td><span className={`dashboard-task-badge dashboard-task-${task.status.toLowerCase()}`}>
                        {taskStatusLabels[task.status]}
                        {task.status === "IN_PROGRESS" && <span className="overview-task-activity" aria-hidden="true">
                          <Icon name="chevron" size={14} />
                          <Icon name="chevron" size={14} />
                          <Icon name="chevron" size={14} />
                        </span>}
                      </span></td>
                      <td><time dateTime={task.lastActivityAt ?? task.createdAt}>{formatTaskTime(task.lastActivityAt ?? task.createdAt)}</time></td>
                    </tr>)}</tbody>
                  </table>
                </div>}
        </div>
      </section>
    </div>

    <div className="overview-team-grid">
      <section className="overview-content-card overview-agent-card" aria-labelledby="overview-agent-connections-title">
        <header className="overview-section-heading">
          <div className="overview-card-title">
            <h2 id="overview-agent-connections-title">Agent 연결 상태</h2>
            <p>등록된 Agent의 연결 현황</p>
          </div>
          <button type="button" className="overview-text-button" onClick={onManageAgents}>전체 보기<Icon name="arrow" size={14} /></button>
        </header>
        <div className="overview-card-body">
          {workspaceLoading ? <div className="overview-loading" role="status">Agent를 불러오고 있어요</div>
            : sortedAgents.length === 0 ? <EmptyState title="등록된 Agent 없음" description="Agent를 등록하고 연결 토큰을 발급해보세요." icon={<Icon name="agent" size={26} />} />
              : <div className="overview-agent-list">{sortedAgents.map((agent) => <div className={`overview-agent-tile ${agent.status === "ONLINE" ? "is-online" : "is-offline"}`} key={agent.agentId}>
                <div className="overview-agent-tile-header">
                  <span className="overview-agent-symbol"><img src={agent.toolType === "CODEX" ? chatgptLogo : claudeLogo} alt={agent.toolType === "CODEX" ? "Codex" : "Claude Code"} width={20} height={20} /></span>
                  <span className={`overview-agent-presence ${agent.status === "ONLINE" ? "is-online" : ""}`}>{agent.status === "ONLINE" ? "온라인" : "오프라인"}</span>
                </div>
                <div className="overview-agent-details">
                  <strong title={agent.name}>{agent.name}</strong>
                  <span className="overview-agent-meta" title={`${owners.get(agent.ownerUserId) ?? "팀원"} · ${agent.projectName}`}>{owners.get(agent.ownerUserId) ?? "팀원"} · {agent.projectName}</span>
                </div>
              </div>)}</div>}
        </div>
      </section>

      <section className="overview-content-card overview-team-card" aria-labelledby="overview-current-team-title">
        <header className="overview-section-heading">
          <div className="overview-card-title">
            <h2 id="overview-current-team-title">현재 팀</h2>
            <p>{team?.name ?? "팀 선택"}{team && <> <span aria-hidden="true">·</span> 팀원 {ready ? members.length : "—"}명</>}</p>
          </div>
          {team && <div className="overview-team-actions">
            <button type="button" className="overview-text-button" onClick={onManageTeams}>팀 관리<Icon name="arrow" size={14} /></button>
            {team.myRole === "OWNER" && <button type="button" className="button button-secondary button-small" disabled={!ready} onClick={onInvite}><Icon name="plus" size={14} />팀원 초대</button>}
          </div>}
        </header>
        <div className="overview-card-body">
          {team ? <>
            <section className="overview-team-members" aria-label="팀원 목록">
              {workspaceLoading ? <p className="overview-member-empty" role="status">팀원을 불러오고 있어요.</p>
                : workspaceError ? <p className="overview-member-empty" role="alert">팀원 정보를 불러오지 못했어요.</p>
                  : members.length === 0 ? <p className="overview-member-empty">참여 중인 팀원이 없어요.</p>
                    : <ul className="overview-member-list">
                      {members.map((member, index) => <li key={member.userId}>
                        <span className={`overview-member-avatar overview-member-avatar-${index % 3}`} aria-hidden="true">{Array.from(member.name.trim()).slice(0, 2).join("") || "—"}</span>
                        <div className="overview-member-name">
                          <strong>{member.name}</strong>
                          {member.nickname && member.nickname !== member.name && <span>@{member.nickname}</span>}
                        </div>
                        <span className="overview-member-agents">Agent {agents.filter((agent) => agent.ownerUserId === member.userId).length}개</span>
                        <span className={`overview-member-role${member.role === "OWNER" ? " is-owner" : ""}`}>{member.role === "OWNER" ? "소유자" : "팀원"}</span>
                      </li>)}
                    </ul>}
            </section>
          </> : <>
            <EmptyState title="참여 중인 팀 없음" description="새 팀을 만들거나 초대 코드로 참여할 수 있어요." icon={<Icon name="team" size={26} />} />
            <button type="button" className="button button-primary overview-create-team" onClick={onManageTeams}>팀 만들기 · 참여하기<Icon name="arrow" size={16} /></button>
          </>}
        </div>
      </section>

    </div>

    <div className="overview-guide-banner"><button type="button" className="overview-text-button" onClick={onGuide}>Agent 연결 가이드<Icon name="arrow" size={15} /></button></div>
  </div>;
}
