import { useId, useState } from "react";
import { EmptyState, Icon } from "@/components/ui";
import { formatDate } from "@/utils";
import chatgptLogo from "@/assets/image/agent-logo/chatgpt.svg";
import claudeLogo from "@/assets/image/agent-logo/claude.svg";
import { agentToolName } from "../lib/agentToolName";
import "@/styles/workspace-management.css";

export default function AgentListView({
  team,
  agents,
  currentUserId,
  loading,
  pcReady,
  connectingAgentId,
  ownerName,
  onShowDetail,
  onConnect,
  onEdit,
  onToken,
  onDelete,
  deleting = false,
  headingActions,
  children,
}) {
  const fieldId = useId();
  const [search, setSearch] = useState("");
  const [connection, setConnection] = useState("all");
  const query = search.trim().toLocaleLowerCase();
  const teamAgents = agents.filter((agent) => agent.teamId === team.teamId);
  const visibleAgents = teamAgents.filter((agent) =>
    (connection === "all" || agent.status === connection)
    && [agent.name, agent.projectName, agent.roleDescription ?? ""].some((value) =>
      value.toLocaleLowerCase().includes(query),
    ),
  );

  return (
    <section className="panel agents-panel" aria-labelledby={`${fieldId}-heading`}>
      <div className="panel-heading">
        <div className="management-heading">
          <div className="management-title-row">
            <h2 className="section-title" id={`${fieldId}-heading`}>Agent 목록</h2>
            <span className="management-count">{loading ? "—" : teamAgents.length}</span>
            {pcReady !== null && (
              <span className={`badge ${pcReady ? "badge-online" : "badge-offline"}`} role="status">
                PC : {pcReady ? "연결" : "미연결"}
              </span>
            )}
          </div>
          <p className="management-description">{team.name}의 Agent와 프로젝트 연결 현황</p>
        </div>
        <div className="section-actions management-actions">
          {headingActions}
        </div>
      </div>

      <div className="agents-toolbar">
        <div className="management-filters" aria-label="Agent 연결 상태 필터">
          {["all", "ONLINE", "OFFLINE"].map((value) => (
            <button key={value} type="button" aria-pressed={connection === value} onClick={() => setConnection(value)}>
              {value === "all" ? "전체" : value === "ONLINE" ? "온라인" : "오프라인"}
              <span>{loading ? "—" : value === "all" ? teamAgents.length : teamAgents.filter((agent) => agent.status === value).length}</span>
            </button>
          ))}
        </div>
        <label className="search-field" htmlFor={`${fieldId}-search`}>
          <span className="sr-only">Agent, 프로젝트, 역할 검색</span>
          <input
            id={`${fieldId}-search`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Agent, 프로젝트, 역할 검색"
            type="search"
          />
        </label>
      </div>

      {loading && (
        <p className="loading-copy" role="status">
          Agent 목록을 불러오고 있습니다.
        </p>
      )}
      {!loading && teamAgents.length === 0 ? (
        <EmptyState
          icon={<Icon name="agent" size={28} />}
          title="등록된 Agent 없음"
          description="이 팀에서 사용할 내 Agent와 담당 프로젝트를 등록할 수 있습니다."
        />
      ) : (
        teamAgents.length > 0 && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Agent</th>
                  <th scope="col">프로젝트</th>
                  <th scope="col">도구</th>
                  <th scope="col">소유자</th>
                  <th scope="col">연결 상태</th>
                  <th scope="col">관리</th>
                </tr>
              </thead>
              <tbody>
                {visibleAgents.map((agent) => (
                  <tr key={agent.agentId}>
                    <td>
                      <div className="agent-cell">
                        <span className="agent-icon">
                          <img src={agent.toolType === "CODEX" ? chatgptLogo : claudeLogo} alt={agentToolName(agent.toolType)} width={22} height={22} />
                        </span>
                        <div>
                          {onShowDetail ? (
                            <button className="agent-name-button" type="button" onClick={() => onShowDetail(agent.agentId)}>
                              {agent.name}
                            </button>
                          ) : <strong className="agent-name-button">{agent.name}</strong>}
                          <div className="agent-meta">{agent.roleDescription || "역할 미등록"}</div>
                        </div>
                      </div>
                    </td>
                    <td>{agent.projectName}</td>
                    <td>
                      <span className="management-tool-name">{agentToolName(agent.toolType)}</span>
                    </td>
                    <td>
                      {ownerName(agent)}
                      {agent.ownerUserId === currentUserId && (
                        <span className="self-label">나</span>
                      )}
                    </td>
                    <td>
                      <div className="status-cell">
                        <span
                          key={agent.status}
                          className={`badge ${agent.status === "ONLINE" ? "badge-online" : "badge-offline"}`}
                          aria-live={connectingAgentId === agent.agentId ? "polite" : undefined}
                        >
                          {agent.status === "ONLINE" ? "온라인" : connectingAgentId === agent.agentId ? "연결 중" : "오프라인"}
                        </span>
                        <div className="status-detail">
                          {agent.lastSeenAt ? formatDate(agent.lastSeenAt) : "접속 기록 없음"}
                        </div>
                      </div>
                    </td>
                    <td>
                      {agent.ownerUserId === currentUserId ? (
                        <div className="section-actions">
                          {onConnect && agent.status === "OFFLINE" && agent.toolType === "CODEX" && (
                            <button
                              className="button button-secondary button-small"
                              type="button"
                              onClick={() => void onConnect(agent)}
                              disabled={connectingAgentId !== null || deleting}
                              aria-label={`${agent.name} 이 PC에서 연결`}
                            >
                              {connectingAgentId === agent.agentId ? "연결 중…" : "이 PC에서 연결"}
                            </button>
                          )}
                          <button
                            className="button button-secondary button-small"
                            type="button"
                            onClick={onEdit ? () => onEdit(agent) : undefined}
                            disabled={deleting}
                            aria-disabled={!onEdit || undefined}
                            aria-label={`${agent.name} 수정`}
                          >
                            수정
                          </button>
                          <button
                            className="button button-secondary button-small"
                            type="button"
                            onClick={onToken ? () => onToken(agent) : undefined}
                            disabled={deleting}
                            aria-disabled={!onToken || undefined}
                          >
                            <Icon name="key" size={15} /> 연결 토큰
                          </button>
                          <button
                            className="button button-danger button-small"
                            type="button"
                            onClick={onDelete ? () => onDelete(agent) : undefined}
                            disabled={deleting}
                            aria-disabled={!onDelete || undefined}
                            aria-label={`${agent.name} 삭제`}
                          >
                            삭제
                          </button>
                        </div>
                      ) : <span className="muted">—</span>}
                    </td>
                  </tr>
                ))}
                {visibleAgents.length === 0 && (
                  <tr>
                    <td className="empty-table-cell" colSpan={6}>
                      조건에 맞는 Agent가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}
      <p className="field-hint agents-footnote">
        {!loading && <span className="management-result-count">{visibleAgents.length}개 표시</span>}
        등록 직후에는 오프라인으로 표시됩니다. 실제 접속 상태는 로컬 연결이 보고된 뒤 반영됩니다.
      </p>
      {children}
    </section>
  );
}
