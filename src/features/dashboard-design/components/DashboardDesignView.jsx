import { useEffect, useRef, useState } from "react";
import BrandLogo from "@/components/common/BrandLogo";
import { Icon } from "@/components/ui/Icon";
import chatgptLogo from "@/assets/image/agent-logo/chatgpt.svg";
import claudeLogo from "@/assets/image/agent-logo/claude.svg";
import { previewAgents, previewTasks, previewTeam } from "../data/dashboardPreviewData";
import "../styles/dashboard-design.css";

const navigation = [
  { id: "overview", label: "대시보드", icon: "grid" },
  { id: "conversations", label: "Agent 대화", icon: "book" },
  { id: "agents", label: "Agent 관리", icon: "agent" },
  { id: "team", label: "팀 관리", icon: "team" },
];
const statusLabels = { PENDING: "수락 대기", IN_PROGRESS: "진행 중", COMPLETED: "완료" };
const pageCopy = {
  overview: "우리 팀의 연결 현황과 진행 중인 작업을 확인하세요.",
  conversations: "Agent 사이에 오가는 요청과 작업 기록을 모아보세요.",
  agents: "프로젝트에 연결된 Agent와 담당 팀원을 확인하세요.",
  team: "함께 작업하는 팀원과 역할을 확인하세요.",
};

function AgentLogo({ agent, small = false }) {
  return <span className={`dd-agent-logo${small ? " dd-agent-logo-small" : ""}`}>
    <img src={agent.tool === "CODEX" ? chatgptLogo : claudeLogo} alt={agent.tool === "CODEX" ? "Codex" : "Claude Code"} width={22} height={22} />
  </span>;
}

function StatusBadge({ status }) {
  return <span className={`dd-status dd-status-${status.toLowerCase()}`}>{statusLabels[status]}</span>;
}

function SearchField({ value, onChange, placeholder }) {
  return <label className="dd-search">
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></svg>
    <input type="search" aria-label={placeholder} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} />
  </label>;
}

function ConversationPanel({ tasks, status, setStatus, onSelect, expanded = false }) {
  const [query, setQuery] = useState("");
  const agents = new Map(previewAgents.map((agent) => [agent.id, agent]));
  const visible = tasks.filter((task) => (status === "all" || task.status === status)
    && `${task.title} ${task.id} ${agents.get(task.requesterId).name} ${agents.get(task.receiverId).name}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <section className={`dd-panel dd-conversations${expanded ? " dd-expanded" : ""}`} aria-labelledby="dd-conversation-title">
    <header className="dd-panel-heading">
      <div><h2 id="dd-conversation-title">최근 Agent 대화 <span className="dd-heading-count">{tasks.length}</span></h2><p>Agent 사이의 작업 요청과 진행 상태</p></div>
      <SearchField value={query} onChange={setQuery} placeholder="대화 검색" />
    </header>
    <div className="dd-table-toolbar">
      <div className="dd-tabs" aria-label="대화 상태 필터">
        {[["all", "전체"], ["IN_PROGRESS", "진행 중"], ["PENDING", "수락 대기"], ["COMPLETED", "완료"]].map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>
          {label}<span>{value === "all" ? tasks.length : tasks.filter((task) => task.status === value).length}</span>
        </button>)}
      </div>
      <span className="dd-sort-label">최근 활동순</span>
    </div>
    <div className="dd-table-scroll" tabIndex={0} role="region" aria-label="Agent 대화 목록">
      <table className="dd-task-table">
        <thead><tr><th scope="col">작업</th><th scope="col">참여 Agent</th><th scope="col">상태</th><th scope="col">최근 활동</th><th scope="col"><span className="dd-sr-only">상세 보기</span></th></tr></thead>
        <tbody>{visible.map((task) => <tr key={task.id}>
          <td><button className="dd-task-link" type="button" onClick={() => onSelect(task.id)}><span className="dd-task-id">#{task.id}</span><strong>{task.title}</strong><span className="dd-sr-only"> 대화 열기</span></button></td>
          <td><div className="dd-agent-pair" title={`${agents.get(task.requesterId).name} → ${agents.get(task.receiverId).name}`}><AgentLogo agent={agents.get(task.requesterId)} small /><span>{agents.get(task.requesterId).name}</span><Icon name="arrow" size={13} /><AgentLogo agent={agents.get(task.receiverId)} small /><span className="dd-sr-only">수신 Agent: {agents.get(task.receiverId).name}</span></div></td>
          <td><StatusBadge status={task.status} /></td>
          <td><time dateTime={task.updatedAt ?? task.createdAt}>{task.time}</time></td>
          <td><Icon name="chevron" size={15} /></td>
        </tr>)}</tbody>
      </table>
      {visible.length === 0 && <div className="dd-empty"><Icon name="book" size={28} /><strong>조건에 맞는 대화가 없어요.</strong><button type="button" className="dd-text-button" onClick={() => { setQuery(""); setStatus("all"); }}>전체 대화 보기<Icon name="arrow" size={15} /></button></div>}
    </div>
    <footer className="dd-panel-footer"><span>{visible.length}개의 대화</span><span>최근 활동 기준으로 표시됩니다.</span></footer>
  </section>;
}

function AgentPanel({ onSelect, onManage, expanded = false }) {
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const visible = previewAgents.filter((agent) => (status === "all" || agent.status === status)
    && `${agent.name} ${agent.owner} ${agent.project}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <section className={`dd-panel dd-agents${expanded ? " dd-expanded" : ""}`} aria-labelledby="dd-agents-title">
    <header className="dd-panel-heading">
      <div><h2 id="dd-agents-title">Agent 연결 상태 <span className="dd-heading-count">{previewAgents.length}</span></h2><p>등록된 Agent와 프로젝트 연결 현황</p></div>
      {!expanded && <button type="button" className="dd-text-button" onClick={onManage}>전체 보기<Icon name="arrow" size={15} /></button>}
      {expanded && <SearchField value={query} onChange={setQuery} placeholder="Agent, 팀원, 프로젝트 검색" />}
    </header>
    <div className="dd-agent-filters" aria-label="Agent 연결 상태 필터">
      {[["all", "전체"], ["ONLINE", "온라인"], ["OFFLINE", "오프라인"]].map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}<span>{value === "all" ? previewAgents.length : previewAgents.filter((agent) => agent.status === value).length}</span></button>)}
    </div>
    <div className="dd-agent-grid">{visible.map((agent) => <button key={agent.id} type="button" className={`dd-agent-tile ${agent.status === "ONLINE" ? "is-online" : "is-offline"}`} title={`${agent.name} · ${agent.owner} · ${agent.project}`} onClick={() => onSelect(agent.id)}>
      <span className="dd-agent-tile-top"><AgentLogo agent={agent} /><span className="dd-presence">{agent.status === "ONLINE" ? "온라인" : "오프라인"}</span></span>
      <span className="dd-agent-tile-body"><strong>{agent.name}</strong><span>{agent.owner} <span aria-hidden="true">·</span> {agent.project}</span></span>
    </button>)}</div>
    {visible.length === 0 && <div className="dd-empty"><strong>검색된 Agent가 없어요.</strong><button type="button" className="dd-text-button" onClick={() => { setQuery(""); setStatus("all"); }}>필터 초기화</button></div>}
  </section>;
}

function TeamPanel({ members, onInvite, onManage, expanded = false }) {
  return <section className={`dd-panel dd-team${expanded ? " dd-expanded" : ""}`} aria-labelledby="dd-team-title">
    <header className="dd-panel-heading"><div><h2 id="dd-team-title">현재 팀</h2><p>{previewTeam.name} <span aria-hidden="true">·</span> 팀원 {members.length}명</p></div><div className="dd-heading-actions">
      {!expanded && <button type="button" className="dd-text-button" onClick={onManage}>팀 관리<Icon name="arrow" size={15} /></button>}
      <button type="button" className="dd-button dd-button-secondary" onClick={onInvite}><Icon name="plus" size={15} />팀원 초대</button>
    </div></header>
    <ul className="dd-member-list">{members.map((member, index) => <li key={member.id}>
      <span className={`dd-member-avatar dd-member-avatar-${index % 3}`} aria-hidden="true">{member.initials}</span>
      <div className="dd-member-name"><strong>{member.name}</strong><span>@{member.nickname}</span></div>
      <span className="dd-member-specialty">{member.specialty}</span>
      <span className={`dd-member-role${member.role === "소유자" ? " is-owner" : ""}`}>{member.role}</span>
    </li>)}</ul>
  </section>;
}

function InvitePreviewForm({ onInvite }) {
  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState(false);
  return <form className="dd-invite-form" onSubmit={(event) => { event.preventDefault(); setInvited(true); onInvite(email); }}>
    <p>함께 작업할 팀원에게 초대 링크를 전달하세요.</p><label>이메일<input type="email" value={email} placeholder="teammate@devlink.team" onChange={(event) => { setEmail(event.target.value); setInvited(false); }} required /></label>
    <button type="submit" className="dd-button dd-button-primary" disabled={invited}><Icon name={invited ? "check" : "plus"} size={17} />{invited ? "초대 화면 확인 완료" : "초대 미리보기"}</button>
    {invited && <p className="dd-form-success" role="status">{email}님을 초대하는 화면입니다. 실제 이메일은 발송되지 않습니다.</p>}
  </form>;
}

function PreviewDialog({ selected, tasks, onClose, onAccept, onInvite }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (selected && !dialog.open) dialog.showModal();
    if (!selected && dialog.open) dialog.close();
  }, [selected]);

  const task = selected?.kind === "task" ? tasks.find((item) => item.id === selected.id) : null;
  const agent = selected?.kind === "agent" ? previewAgents.find((item) => item.id === selected.id) : null;
  const title = task ? "Agent 대화" : agent ? "Agent 정보" : selected?.kind === "invite" ? "팀원 초대" : "Agent 연결 가이드";

  return <dialog ref={dialogRef} className="dd-dialog" aria-labelledby="dd-dialog-title" onCancel={onClose} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    {selected && <div className="dd-dialog-content">
      <header className="dd-dialog-heading"><div><span className="dd-eyebrow">{previewTeam.name}</span><h2 id="dd-dialog-title">{title}</h2></div><button type="button" className="dd-icon-button" aria-label="상세 패널 닫기" onClick={onClose}><Icon name="close" /></button></header>
      {task && <>
        <div className="dd-dialog-task-meta"><span>#{task.id}</span><StatusBadge status={task.status} /><span>{task.time}</span></div>
        <div className="dd-request"><span>최초 요청</span><h3>{task.title}</h3><p>{task.description}</p></div>
        <div className="dd-message-list">{task.messages.map((message, index) => {
          const sender = previewAgents.find((item) => item.id === (message.sender === "requester" ? task.requesterId : task.receiverId));
          return <div key={`${message.time}-${index}`} className="dd-message"><AgentLogo agent={sender} small /><div><div className="dd-message-heading"><strong>{sender.name}</strong><span>{message.time}</span></div><p>{message.text}</p></div></div>;
        })}</div>
        {task.status === "PENDING" && <button type="button" className="dd-button dd-button-primary dd-dialog-action" onClick={() => onAccept(task.id)}><Icon name="check" size={17} />샘플 요청 수락</button>}
      </>}
      {agent && <><div className="dd-agent-detail-title"><AgentLogo agent={agent} /><div><h3>{agent.name}</h3><span>{agent.tool === "CODEX" ? "Codex" : "Claude Code"}</span></div><span className={`dd-detail-presence ${agent.status === "ONLINE" ? "is-online" : ""}`}>{agent.status === "ONLINE" ? "온라인" : "오프라인"}</span></div><dl className="dd-detail-fields"><div><dt>담당 팀원</dt><dd>{agent.owner}</dd></div><div><dt>프로젝트</dt><dd>{agent.project}</dd></div><div><dt>참여 중인 대화</dt><dd>{tasks.filter((item) => item.requesterId === agent.id || item.receiverId === agent.id).length}개</dd></div></dl></>}
      {selected.kind === "invite" && <InvitePreviewForm onInvite={onInvite} />}
      {selected.kind === "guide" && <div className="dd-guide-content"><p>사용 중인 개발 도구를 팀의 협업 공간에 연결하세요.</p><ol><li><strong>Agent 등록</strong><span>팀에서 사용할 Agent의 이름과 프로젝트를 등록합니다.</span></li><li><strong>연결 정보 설정</strong><span>발급받은 연결 정보를 Codex 또는 Claude Code에 설정합니다.</span></li><li><strong>팀과 작업 시작</strong><span>온라인 상태를 확인하고 Agent 사이에 작업을 요청합니다.</span></li></ol></div>}
      <footer className="dd-dialog-note">디자인 미리보기 · 실제 서비스 데이터에는 영향을 주지 않습니다.</footer>
    </div>}
  </dialog>;
}

export default function DashboardDesignView() {
  const [page, setPage] = useState("overview");
  const [tasks, setTasks] = useState(previewTasks);
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const menuDialogRef = useRef(null);
  const mainRef = useRef(null);
  const contentRef = useRef(null);
  const pending = tasks.filter((task) => task.status === "PENDING");
  const online = previewAgents.filter((agent) => agent.status === "ONLINE");
  const currentPage = navigation.find((item) => item.id === page);

  useEffect(() => {
    const dialog = menuDialogRef.current;
    if (menuOpen && !dialog.open) dialog.showModal();
    if (!menuOpen && dialog.open) dialog.close();
  }, [menuOpen]);

  function navigate(nextPage, nextStatus = "all") {
    menuDialogRef.current?.close();
    setPage(nextPage);
    setStatus(nextStatus);
    setMenuOpen(false);
    mainRef.current?.scrollTo({ top: 0 });
    contentRef.current?.focus({ preventScroll: true });
  }

  function openDetails(nextSelection) {
    menuDialogRef.current?.close();
    setMenuOpen(false);
    setSelected(nextSelection);
  }

  function acceptTask(id) {
    setTasks((previous) => {
      const task = previous.find((item) => item.id === id);
      const updated = { ...task, status: "IN_PROGRESS", time: "방금", updatedAt: new Date().toISOString(), messages: [...task.messages, { sender: "receiver", text: "요청을 수락했습니다. 작업 내용을 확인하고 진행하겠습니다.", time: "방금" }] };
      return [updated, ...previous.filter((item) => item.id !== id)];
    });
    setNotice("샘플 요청을 수락했습니다.");
  }

  function sidebarContent(mobile = false) {
    return <>
      <div className="dd-brand-row"><BrandLogo className="dd-brand" />{mobile && <button type="button" className="dd-icon-button" aria-label="메뉴 닫기" onClick={() => setMenuOpen(false)}><Icon name="close" /></button>}</div>
      <div className="dd-workspace-label"><span className="dd-workspace-symbol"><Icon name="team" size={19} /></span><div><strong>{previewTeam.name}</strong><span>팀 워크스페이스</span></div></div>
      <nav className="dd-navigation" aria-label={mobile ? "모바일 워크스페이스 메뉴" : "워크스페이스 메뉴"}>
        <span className="dd-nav-label">워크스페이스</span>
        {navigation.map((item) => <button type="button" key={item.id} aria-current={page === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><Icon name={item.icon} size={19} /><span>{item.label}</span>{item.id === "conversations" && pending.length > 0 && <span className="dd-nav-count">{pending.length}</span>}</button>)}
      </nav>
      <div className="dd-recent"><span className="dd-nav-label">최근 대화</span>{tasks.slice(0, 3).map((task) => <button type="button" key={task.id} onClick={() => openDetails({ kind: "task", id: task.id })}><span>#{task.id}</span><strong>{task.title}</strong></button>)}</div>
      <div className="dd-sidebar-bottom"><button type="button" className="dd-guide-link" onClick={() => openDetails({ kind: "guide" })}><span className="dd-guide-icon"><Icon name="book" size={18} /></span><span><strong>Agent 연결 가이드</strong><small>Codex · Claude Code 설정</small></span><Icon name="arrow" size={15} /></button><div className="dd-profile"><span className="dd-profile-avatar">JM</span><div><strong>이정민</strong><span>jungmin · 소유자</span></div><span className="dd-sample-label">샘플</span></div></div>
    </>;
  }

  return <div className="dd-app">
    <a className="dd-skip-link" href="#dd-main">본문으로 바로가기</a>
    <aside className="dd-sidebar">{sidebarContent()}</aside>
    <dialog className="dd-menu-dialog" ref={menuDialogRef} onCancel={() => setMenuOpen(false)} onClose={() => setMenuOpen(false)} aria-label="워크스페이스 메뉴"><div className="dd-mobile-sidebar">{sidebarContent(true)}</div></dialog>
    <div className="dd-main-shell" ref={mainRef}>
      <header className="dd-topbar"><div className="dd-breadcrumb"><button type="button" className="dd-icon-button dd-menu-trigger" aria-label="워크스페이스 메뉴 열기" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Icon name="grid" /></button><span>워크스페이스</span><span aria-hidden="true">/</span><strong>{currentPage.label}</strong></div><div className="dd-preview-label"><span>디자인 시안</span><span>샘플 데이터</span></div><a href="/" className="dd-service-link">메인 서비스<Icon name="arrow" size={15} /></a></header>
      <main className="dd-main" id="dd-main" tabIndex={-1} ref={contentRef}>
        <div className="dd-page-heading"><div><div className="dd-page-eyebrow">{previewTeam.name}</div><h1>{currentPage.label}</h1><p>{pageCopy[page]}</p></div><div className="dd-page-actions"><button type="button" className="dd-icon-button dd-reset-button" aria-label="시안의 샘플 데이터 초기화" title="샘플 데이터 초기화" onClick={() => { setTasks(previewTasks); setNotice("샘플 데이터를 초기화했습니다."); }}><Icon name="refresh" size={18} /></button><a href="/" className="dd-button dd-button-secondary"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="m12 2 9 5v10l-9 5-9-5V7Z M3 7l9 5 9-5M12 12v10" /></svg>3D 스페이스<Icon name="arrow" size={16} /></a></div></div>
        {page === "overview" && <>
          <div className="dd-summary-grid">
            <section className="dd-agent-summary" aria-labelledby="dd-agent-summary-title"><div className="dd-summary-top"><h2 id="dd-agent-summary-title">팀 Agent</h2><button type="button" className="dd-text-button" onClick={() => navigate("agents")}>Agent 관리<Icon name="arrow" size={15} /></button></div><div className="dd-agent-metrics"><div><span>전체 Agent</span><strong>{previewAgents.length}<small>개</small></strong></div><span className="dd-metric-divider" /><div><span>온라인</span><strong>{online.length}<small>개</small></strong></div><div className="dd-connection-overview"><div className="dd-connection-bars" aria-hidden="true">{previewAgents.map((agent) => <span key={agent.id} className={agent.status === "ONLINE" ? "is-online" : ""} />)}</div><span>{previewAgents.length}개 중 {online.length}개가 연결되어 있어요.</span></div></div></section>
            <section className="dd-pending-summary" aria-labelledby="dd-pending-title"><div className="dd-summary-top"><h2 id="dd-pending-title">수락 대기 요청</h2><Icon name="clock" size={20} /></div><div className="dd-pending-bottom"><strong>{pending.length}<small>건</small></strong><button type="button" className="dd-text-button" onClick={() => navigate("conversations", "PENDING")}>{pending.length > 0 ? "요청 확인하기" : "요청 내역 보기"}<Icon name="arrow" size={17} /></button></div></section>
            <section className="dd-team-summary" aria-label="현재 팀 요약"><span>현재 팀</span><h2>{previewTeam.name}</h2><div><span>팀원 {previewTeam.members.length}명 <span aria-hidden="true">·</span> Agent {previewAgents.length}개</span><button type="button" aria-label="현재 팀 정보 보기" onClick={() => navigate("team")}><Icon name="arrow" size={19} /></button></div></section>
          </div>
          <ConversationPanel tasks={tasks} status={status} setStatus={setStatus} onSelect={(id) => setSelected({ kind: "task", id })} />
          <div className="dd-bottom-grid"><AgentPanel onSelect={(id) => setSelected({ kind: "agent", id })} onManage={() => navigate("agents")} /><TeamPanel members={previewTeam.members} onInvite={() => setSelected({ kind: "invite" })} onManage={() => navigate("team")} /></div>
        </>}
        {page === "conversations" && <ConversationPanel tasks={tasks} status={status} setStatus={setStatus} expanded onSelect={(id) => setSelected({ kind: "task", id })} />}
        {page === "agents" && <AgentPanel expanded onSelect={(id) => setSelected({ kind: "agent", id })} />}
        {page === "team" && <TeamPanel expanded members={previewTeam.members} onInvite={() => setSelected({ kind: "invite" })} />}
        <footer className="dd-page-footer"><span>DevLink <span aria-hidden="true">/</span> 워크스페이스</span><span>디자인 미리보기 · 실제 데이터와 연결되지 않은 화면입니다.</span></footer>
        <span className="dd-sr-only" role="status">{notice}</span>
      </main>
    </div>
    <PreviewDialog selected={selected} tasks={tasks} onClose={() => setSelected(null)} onAccept={acceptTask} onInvite={() => setNotice("샘플 초대 화면을 확인했습니다.")} />
  </div>;
}
