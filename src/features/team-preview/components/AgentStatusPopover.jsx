import chatgptLogo from "@/assets/image/agent-logo/chatgpt.svg";
import claudeLogo from "@/assets/image/agent-logo/claude.svg";
import "../styles/agent-status-popover.css";

const activityLabels = {
  working: "진행 중인 작업",
  requesting: "요청한 작업",
  idle: "진행 중인 작업 없음",
  loading: "작업 정보 확인 중",
  unavailable: "작업 정보 확인 불가",
};

export default function AgentStatusPopover({ id, panelRef, agent, activity, onClose }) {
  const state = activity?.state ?? "unavailable";
  const summary = activity?.summary || "현재 확인할 수 있는 작업 정보가 없습니다.";

  return (
    <section
      id={id}
      ref={panelRef}
      className="itp-agent-status-popover"
      role="dialog"
      aria-modal="false"
      aria-labelledby={`${id}-name`}
      aria-describedby={`${id}-activity ${id}-summary`}
      tabIndex={-1}
      style={{ visibility: "hidden" }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
    >
      <header className="itp-agent-status-heading">
        <div>
          <img className="itp-agent-status-tool" src={agent.tool === "Codex" ? chatgptLogo : claudeLogo} alt={agent.tool} title={agent.tool} width={20} height={20} />
          <h3 id={`${id}-name`} title={agent.name}>{agent.name}</h3>
        </div>
        <button type="button" className="itp-agent-status-close" aria-label="Agent 상태 닫기" onClick={onClose}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      </header>
      <div className="itp-agent-status-content" tabIndex={0} aria-label="Agent 작업 정보">
        <div className="itp-agent-status-activity" data-state={state}>
          <strong id={`${id}-activity`} className="itp-agent-status-activity-heading">{activityLabels[state] ?? activityLabels.unavailable}</strong>
          <p id={`${id}-summary`} title={summary}>{summary}</p>
        </div>
      </div>
    </section>
  );
}
