import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Agent, CreateAgentInput } from "../types";
import type { Team, TeamMember } from "@/features/teams/types";
import { useAgent, useAgentMutations } from "../hooks/useAgents";
import { agentApi } from "../api/agentApi";
import { copyText, formatDate } from "@/utils";
import { Icon, Modal } from "@/components/ui";
import chatgptLogo from "@/assets/image/agent-logo/chatgpt.svg";
import claudeLogo from "@/assets/image/agent-logo/claude.svg";
import { getDesktopApi } from "@/features/desktop-setup/api/desktopApi";
import ProjectConnectView from "@/features/desktop-setup/components/ProjectConnectView";
import AgentListView from "./AgentListView";
import { agentToolName } from "../lib/agentToolName";

interface AgentsPanelProps {
  team: Team;
  agents: Agent[];
  members: TeamMember[];
  currentUserId: number;
  currentUserEmail: string;
  loading: boolean;
  onRefresh: () => void;
  onError: (error: unknown) => void;
  onNotice: (message: string) => void;
}

interface AgentForm {
  name: string;
  roleDescription: string;
  projectName: string;
  toolType: CreateAgentInput["toolType"];
}

const emptyForm: AgentForm = {
  name: "",
  roleDescription: "",
  projectName: "",
  toolType: "CODEX",
};

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "요청을 처리하지 못했습니다. 잠시 후 다시 확인해주세요.";
}

const onlineCheckInterval = 2_000;
const onlineCheckTimeout = 90_000;

export default function AgentsPanel({
  team,
  agents,
  members,
  currentUserId,
  currentUserEmail,
  loading,
  onRefresh,
  onError,
  onNotice,
}: AgentsPanelProps) {
  const fieldId = useId();
  const desktop = getDesktopApi();
  const active = useRef(true);
  const connecting = useRef<AbortController | null>(null);
  const mutations = useAgentMutations(currentUserId, team.teamId);
  const [pcReady, setPcReady] = useState<boolean | null>(null);
  const [connectingAgentId, setConnectingAgentId] = useState<number | null>(null);
  const [formTarget, setFormTarget] = useState<Agent | "register" | null>(null);
  const [form, setForm] = useState<AgentForm>(emptyForm);
  const saving = mutations.registerAgent.isPending || mutations.updateAgent.isPending;
  const [formError, setFormError] = useState<string | null>(null);
  const [detailAgentId, setDetailAgentId] = useState<number | null>(null);
  const detailQuery = useAgent(currentUserId, detailAgentId);
  const listedDetailAgent = agents.find((agent) => agent.agentId === detailAgentId);
  const detail =
    detailAgentId === null
      ? null
      : {
        agent: detailQuery.data && listedDetailAgent
          ? { ...detailQuery.data, status: listedDetailAgent.status, lastSeenAt: listedDetailAgent.lastSeenAt }
          : null,
        loading: !!listedDetailAgent && detailQuery.isFetching && detailQuery.data === undefined,
        error: detailQuery.error ? errorMessage(detailQuery.error)
          : listedDetailAgent ? null : "현재 팀의 Agent 목록에서 찾을 수 없습니다.",
      };
  const [tokenAgent, setTokenAgent] = useState<Agent | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [tokenVisible, setTokenVisible] = useState(false);
  const issuing = mutations.issueAgentToken.isPending;
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const deleting = mutations.deleteAgent.isPending;
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      connecting.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (detailAgentId !== null && detailQuery.error) onError(detailQuery.error);
  }, [detailAgentId, detailQuery.error, onError]);

  const editingAgent = formTarget === "register" ? null : formTarget;
  const formChanged =
    !editingAgent ||
    form.name !== editingAgent.name ||
    form.projectName !== editingAgent.projectName ||
    form.roleDescription !== (editingAgent.roleDescription ?? "");
  function ownerName(agent: Agent): string {
    const owner = members.find((member) => member.userId === agent.ownerUserId);
    return owner?.nickname || owner?.name || `사용자 #${agent.ownerUserId}`;
  }

  async function connectAgent(agent: Agent) {
    const launch = desktop?.setup?.connectAgent;
    if (!launch || connecting.current || agent.ownerUserId !== currentUserId ||
        agent.status !== "OFFLINE" || agent.toolType !== "CODEX") return;
    const controller = new AbortController();
    connecting.current = controller;
    setConnectingAgentId(agent.agentId);

    try {
      await launch({ userId: currentUserId, teamId: team.teamId, email: currentUserEmail }, agent.agentId);
      const deadline = Date.now() + onlineCheckTimeout;
      while (!controller.signal.aborted && Date.now() < deadline) {
        const latest = await agentApi.getAgent(agent.agentId, controller.signal);
        if (controller.signal.aborted) return;
        if (latest.status === "ONLINE") {
          onRefresh();
          onNotice(`${agent.name} Agent가 온라인으로 연결됐습니다.`);
          return;
        }
        await new Promise<void>((resolve) => window.setTimeout(resolve, onlineCheckInterval));
      }
      if (!controller.signal.aborted) {
        onError(new Error("온라인 연결을 아직 확인하지 못했습니다. 열린 Codex 터미널의 승인 요청과 연결 결과를 확인해주세요."));
      }
    } catch (error) {
      if (!controller.signal.aborted) onError(error);
    } finally {
      connecting.current = null;
      if (!controller.signal.aborted) setConnectingAgentId(null);
    }
  }

  function openRegister() {
    setForm(emptyForm);
    setFormError(null);
    setFormTarget("register");
  }

  function openEdit(agent: Agent) {
    if (agent.ownerUserId !== currentUserId) return;
    setForm({
      name: agent.name,
      projectName: agent.projectName,
      roleDescription: agent.roleDescription ?? "",
      toolType: agent.toolType,
    });
    setFormError(null);
    setFormTarget(agent);
  }

  function closeForm() {
    if (!saving) setFormTarget(null);
  }

  async function saveAgent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !formTarget ||
      saving ||
      !formChanged ||
      (editingAgent && editingAgent.ownerUserId !== currentUserId)
    )
      return;
    const name = form.name.trim();
    const projectName = form.projectName.trim();
    const roleDescription = form.roleDescription.trim();
    if (!name || !projectName) {
      setFormError("Agent 이름과 프로젝트명을 입력해주세요.");
      return;
    }
    setFormError(null);
    try {
      if (editingAgent) {
        await mutations.updateAgent.mutateAsync({
          agentId: editingAgent.agentId,
          input: {
            ...(form.name !== editingAgent.name ? { name } : {}),
            ...(form.projectName !== editingAgent.projectName ? { projectName } : {}),
            ...(form.roleDescription !== (editingAgent.roleDescription ?? "")
              ? { roleDescription }
              : {}),
          },
        });
      } else {
        await mutations.registerAgent.mutateAsync({
          name,
          projectName,
          toolType: form.toolType,
          ...(roleDescription ? { roleDescription } : {}),
        });
      }
      if (!active.current) return;
      setFormTarget(null);
      setForm(emptyForm);
      onNotice(editingAgent ? "Agent 정보를 수정했습니다." : "내 Agent를 팀에 등록했습니다.");
    } catch (error) {
      if (!active.current) return;
      setFormError(errorMessage(error));
      onError(error);
    }
  }

  function showDetail(agentId: number) {
    setDetailAgentId(agentId);
  }

  function closeDetail() {
    setDetailAgentId(null);
  }

  function openToken(agent: Agent) {
    setTokenAgent(agent);
    setIssuedToken(null);
    setTokenVisible(false);
    setTokenError(null);
  }

  function closeToken() {
    if (issuing) return;
    setTokenAgent(null);
    setIssuedToken(null);
    setTokenVisible(false);
    setTokenError(null);
  }

  async function issueToken() {
    if (!tokenAgent || issuing) return;
    const agentId = tokenAgent.agentId;
    setTokenError(null);
    try {
      const result = await mutations.issueAgentToken.mutateAsync(agentId);
      if (!active.current) return;
      if (result.agentId !== agentId || !result.token) {
        throw new Error("토큰 응답을 확인하지 못했습니다. Agent 정보를 새로고침해주세요.");
      }
      setIssuedToken(result.token);
      setTokenVisible(false);
      onNotice("Agent 연결 토큰을 발급했습니다.");
    } catch (error) {
      if (!active.current) return;
      setTokenError(errorMessage(error));
      onError(error);
    } finally {
      mutations.issueAgentToken.reset();
    }
  }

  function openDelete(agent: Agent) {
    if (agent.ownerUserId !== currentUserId || deleting) return;
    setDeleteTarget(agent);
    setDeleteError(null);
  }

  function closeDelete() {
    if (!deleting) setDeleteTarget(null);
  }

  async function deleteAgent() {
    if (!deleteTarget || deleting || deleteTarget.ownerUserId !== currentUserId) return;
    const agentId = deleteTarget.agentId;
    setDeleteError(null);
    try {
      await mutations.deleteAgent.mutateAsync(agentId);
      if (!active.current) return;
      if (detailAgentId === agentId) setDetailAgentId(null);
      if (tokenAgent?.agentId === agentId) {
        setTokenAgent(null);
        setIssuedToken(null);
        setTokenVisible(false);
        setTokenError(null);
      }
      setDeleteTarget(null);
      onNotice("Agent를 삭제했습니다.");
    } catch (error) {
      if (!active.current) return;
      setDeleteError(errorMessage(error));
      onError(error);
    }
  }

  async function copyToken() {
    if (!issuedToken) return;
    try {
      await copyText(issuedToken);
      if (active.current) onNotice("연결 토큰을 복사했습니다.");
    } catch {
      if (active.current)
        setTokenError("자동 복사를 사용할 수 없습니다. 토큰을 표시한 뒤 직접 선택해 복사해주세요.");
    }
  }

  return (
    <AgentListView
      team={team}
      agents={agents}
      currentUserId={currentUserId}
      loading={loading}
      pcReady={pcReady}
      connectingAgentId={connectingAgentId}
      ownerName={ownerName}
      onShowDetail={showDetail}
      onConnect={desktop?.setup?.connectAgent ? connectAgent : undefined}
      onEdit={openEdit}
      onToken={openToken}
      onDelete={openDelete}
      deleting={deleting}
      headingActions={desktop?.setup && desktop.getStatus ? (
          <ProjectConnectView
            key={`${currentUserId}:${team.teamId}:${currentUserEmail}`}
            setup={desktop.setup}
            getStatus={desktop.getStatus}
            account={{ userId: currentUserId, teamId: team.teamId, email: currentUserEmail }}
            teamName={team.name}
            onRefreshAgents={onRefresh}
            onReadyChange={setPcReady}
          />
        ) : (
          <button
            className="button button-primary"
            type="button"
            onClick={openRegister}
            disabled={loading}
          >
            <Icon name="plus" size={18} /> Agent 등록
          </button>
        )}
    >
      {deleteTarget && (
        <Modal
          title="Agent 삭제"
          description={`${deleteTarget.name} · ${deleteTarget.projectName}`}
          busy={deleting}
          onClose={closeDelete}
        >
          <p>
            이 Agent를 삭제할까요? 삭제하면 기존 연결 토큰을 사용할 수 없고 브로커 연결이
            종료됩니다.
          </p>
          <p className="field-hint">
            작업을 요청하거나 받은 이력이 있는 Agent는 삭제할 수 없습니다.
          </p>
          {deleteError && (
            <p className="inline-error" role="alert">
              {deleteError}
            </p>
          )}
          <div className="modal-footer">
            <button
              className="button button-secondary"
              type="button"
              disabled={deleting}
              onClick={closeDelete}
            >
              취소
            </button>
            <button
              className="button button-danger"
              type="button"
              disabled={deleting}
              onClick={() => {
                void deleteAgent();
              }}
            >
              {deleting ? "삭제 중…" : "Agent 삭제"}
            </button>
          </div>
        </Modal>
      )}

      {formTarget && (
        <Modal
          title={editingAgent ? "Agent 정보 수정" : "내 Agent 등록"}
          description={
            editingAgent
              ? `${editingAgent.name}의 정보를 수정합니다.`
              : `${team.name} 팀에 등록할 Agent 정보를 입력해주세요.`
          }
          busy={saving}
          onClose={closeForm}
        >
          <form
            className="grid gap-4.5"
            onSubmit={(event) => {
              void saveAgent(event);
            }}
          >
            <div className="field">
              <label htmlFor={`${fieldId}-name`}>
                Agent 이름 <span className="required-mark">*</span>
              </label>
              <input
                id={`${fieldId}-name`}
                value={form.name}
                maxLength={100}
                required
                autoFocus
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="예: 프론트엔드 Agent"
                disabled={saving}
              />
            </div>
            <div className={editingAgent ? undefined : "form-row"}>
              <div className="field">
                <label htmlFor={`${fieldId}-project`}>
                  {editingAgent ? "프로젝트 표시명" : "프로젝트명"}{" "}
                  <span className="required-mark">*</span>
                </label>
                <input
                  id={`${fieldId}-project`}
                  value={form.projectName}
                  maxLength={120}
                  required
                  onChange={(event) => setForm({ ...form, projectName: event.target.value })}
                  placeholder="예: DevLink Web"
                  disabled={saving}
                />
              </div>
              {!editingAgent && (
                <div className="field">
                  <label htmlFor={`${fieldId}-tool`}>사용 도구</label>
                  <select
                    id={`${fieldId}-tool`}
                    value={form.toolType}
                    disabled={saving}
                    onChange={(event) =>
                      setForm({ ...form, toolType: event.target.value as AgentForm["toolType"] })
                    }
                  >
                    <option value="CODEX">Codex</option>
                    <option value="CLAUDE_CODE">Claude Code</option>
                  </select>
                </div>
              )}
            </div>
            <div className="field">
              <label htmlFor={`${fieldId}-role`}>
                담당 역할 <span className="muted">선택</span>
              </label>
              <textarea
                id={`${fieldId}-role`}
                value={form.roleDescription}
                maxLength={255}
                rows={3}
                onChange={(event) => setForm({ ...form, roleDescription: event.target.value })}
                placeholder="예: 화면 구성과 사용자 인증 연동을 담당합니다."
                disabled={saving}
              />
              <span className="field-hint">{form.roleDescription.length}/255자</span>
            </div>
            {formError && (
              <p className="inline-error" role="alert">
                {formError}
              </p>
            )}
            <div className="modal-footer">
              <button
                className="button button-secondary"
                type="button"
                disabled={saving}
                onClick={closeForm}
              >
                취소
              </button>
              <button
                className="button button-primary"
                type="submit"
                disabled={saving || !formChanged}
              >
                {editingAgent
                  ? saving
                    ? "저장 중…"
                    : "변경 사항 저장"
                  : saving
                    ? "등록 중…"
                    : "Agent 등록"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {detail && (
        <Modal title="Agent 상세 정보" onClose={closeDetail}>
          {detail.loading && (
            <p className="loading-copy" role="status">
              상세 정보를 불러오고 있습니다.
            </p>
          )}
          {detail.error && (
            <p className="inline-error" role="alert">
              {detail.error}
            </p>
          )}
          {detail.agent && (
            <dl className="detail-grid">
              <div className="detail-item">
                <dt>Agent 이름</dt>
                <dd>{detail.agent.name}</dd>
              </div>
              <div className="detail-item">
                <dt>Agent ID</dt>
                <dd>#{detail.agent.agentId}</dd>
              </div>
              <div className="detail-item">
                <dt>프로젝트</dt>
                <dd>{detail.agent.projectName}</dd>
              </div>
              <div className="detail-item">
                <dt>도구</dt>
                <dd className="management-tool-detail"><img src={detail.agent.toolType === "CODEX" ? chatgptLogo : claudeLogo} alt="" width={18} height={18} />{agentToolName(detail.agent.toolType)}</dd>
              </div>
              <div className="detail-item">
                <dt>소유자</dt>
                <dd>{ownerName(detail.agent)}</dd>
              </div>
              <div className="detail-item">
                <dt>연결 상태</dt>
                <dd>{detail.agent.status === "ONLINE" ? "온라인" : "오프라인"}</dd>
              </div>
              <div className="detail-item">
                <dt>등록일</dt>
                <dd>{formatDate(detail.agent.createdAt)}</dd>
              </div>
              <div className="detail-item">
                <dt>마지막 접속</dt>
                <dd>
                  {detail.agent.lastSeenAt ? formatDate(detail.agent.lastSeenAt) : "접속 기록 없음"}
                </dd>
              </div>
              <div className="detail-item detail-item-full">
                <dt>담당 역할</dt>
                <dd>{detail.agent.roleDescription || "역할 미등록"}</dd>
              </div>
            </dl>
          )}
          <div className="modal-footer">
            <button className="button button-secondary" type="button" onClick={closeDetail}>
              닫기
            </button>
          </div>
        </Modal>
      )}

      {tokenAgent && (
        <Modal
          title={issuedToken ? "연결 토큰 발급 완료" : "Agent 연결 토큰"}
          description={`${tokenAgent.name} · ${tokenAgent.projectName}`}
          busy={issuing}
          onClose={closeToken}
        >
          {issuedToken ? (
            <>
              <p className="token-warning">
                토큰 원문은 이 화면에서만 확인할 수 있습니다. 창을 닫기 전에 안전한 곳에
                보관해주세요.
              </p>
              <div className="field">
                <label htmlFor={`${fieldId}-token`}>발급된 연결 토큰</label>
                <div className="token-field">
                  <input
                    id={`${fieldId}-token`}
                    type={tokenVisible ? "text" : "password"}
                    value={issuedToken}
                    readOnly
                    autoComplete="off"
                    spellCheck={false}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => setTokenVisible(!tokenVisible)}
                    aria-label={tokenVisible ? "토큰 숨기기" : "토큰 표시"}
                    aria-pressed={tokenVisible}
                  >
                    <Icon name={tokenVisible ? "eye-off" : "eye"} size={18} />
                  </button>
                  <button
                    className="button button-secondary button-small"
                    type="button"
                    onClick={() => {
                      void copyToken();
                    }}
                  >
                    <Icon name="copy" size={16} /> 복사
                  </button>
                </div>
              </div>
              <p className="field-hint">
                이 화면을 닫으면 토큰을 다시 조회할 수 없습니다. 필요한 경우 새 토큰을 발급해주세요.
              </p>
            </>
          ) : (
            <>
              <div className="token-warning">
                <strong>기존 토큰이 있으면 새 토큰으로 교체됩니다.</strong>
                <p>
                  이전 토큰은 사용할 수 없고 기존 연결이 종료됩니다. 새 토큰이 필요할 때
                  발급해주세요.
                </p>
              </div>
              <p className="muted">
                토큰은 이 Agent의 연결 자격정보입니다. 다른 사람에게 공유하거나 공개 저장소에 올리지
                마세요.
              </p>
            </>
          )}
          {tokenError && (
            <p className="inline-error" role="alert">
              {tokenError}
            </p>
          )}
          <div className="modal-footer">
            <button
              className="button button-secondary"
              type="button"
              disabled={issuing}
              onClick={closeToken}
            >
              {issuedToken ? "닫기" : "취소"}
            </button>
            {!issuedToken && (
              <button
                className="button button-primary"
                type="button"
                disabled={issuing}
                onClick={() => {
                  void issueToken();
                }}
              >
                <Icon name="key" size={16} /> {issuing ? "발급 중…" : "새 연결 토큰 발급"}
              </button>
            )}
          </div>
        </Modal>
      )}
    </AgentListView>
  );
}
