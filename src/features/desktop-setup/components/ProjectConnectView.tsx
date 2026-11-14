import { t as translate, useTranslation } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Icon, Modal } from "@/components/ui";
import { copyText } from "@/utils";
import type {
  DesktopSetupApi,
  DesktopStatus,
  ProjectSelection,
  SetupAccount,
  SetupResult,
  SetupTool,
  SavedConnection,
} from "../api/desktopApi";
import { getDesktopApi } from "../api/desktopApi";
import { createSetupAgentMetadata, setupToolNames } from "../lib/agentMetadata";
import { localizeSetupError } from "../lib/setupErrors";
import McpGuideView from "./McpGuideView";
import ProjectConnectForm from "./ProjectConnectForm";
import ProjectConnectSummary from "./ProjectConnectSummary";
import ProjectFolderPicker from "./ProjectFolderPicker";

interface ProjectConnectViewProps {
  setup: DesktopSetupApi;
  getStatus: (account: SetupAccount) => Promise<DesktopStatus>;
  account: SetupAccount;
  teamName: string;
  onRefreshAgents: () => void;
  presentation?: "modal" | "page";
  onBusyChange?: (busy: boolean) => void;
  // - 전달 시 연결 상태 배지는 부모가 표시
  onReadyChange?: (ready: boolean | null) => void;
  onConnected?: () => void;
  onFinish?: () => void;
  onOpenDashboard?: () => void;
}

type View =
  | {
      state:
        | "choose"
        | "picking"
        | "select-tool"
        | "running"
        | "connections"
        | "guide";
    }
  | SetupResult;

// 같은 입력으로 다시 실행해도 결과가 바뀌지 않는 오류
const noRetryCodes = [
  "SETUP_REGISTRATION_UNKNOWN",
  "SETUP_PROFILE_CONFLICT",
  "SETUP_AGENT_BINDING_CONFLICT",
  "SETUP_AGENT_REJECTED",
];

const steps = [
  { label: "계정 확인", keys: ["validate", "authenticate"] },
  { label: "팀·프로젝트 확인", keys: ["select_team", "bind_project"] },
  { label: "AI 도구·Agent 확인", keys: ["select_tool", "register_agent"] },
  {
    label: "연결",
    keys: ["start_broker", "configure_mcp", "verify_connection"],
  },
];

function stepLabel(statuses: (string | undefined)[]) {
  if (statuses.some((status) => status === "failed")) return "오류";
  if (statuses.every((status) => status === "succeeded")) return "완료";
  if (statuses.some(Boolean)) return "진행 중";
  return "대기";
}

function messageFrom(error: unknown) {
  if (!(error instanceof Error)) return translate("프로젝트 연결 중 오류가 발생했습니다.");
  return error.message.replace(
    /^Error invoking remote method '[^']+': Error: /,
    "",
  );
}

export default function ProjectConnectView({
  setup,
  getStatus,
  account,
  teamName,
  onRefreshAgents,
  presentation = "modal",
  onBusyChange,
  onReadyChange,
  onConnected,
  onFinish,
  onOpenDashboard,
}: ProjectConnectViewProps) {
  const { t } = useTranslation();
  const [view, setView] = useState<View | null>(
    presentation === "page" ? { state: "choose" } : null,
  );
  const [project, setProject] = useState<ProjectSelection | null>(null);
  const [selectedTool, setSelectedTool] = useState<SetupTool | null>(null);
  const [agentPart, setAgentPart] = useState("");
  const [rolesText, setRolesText] = useState("");
  const [metadataError, setMetadataError] = useState("");
  // 한 번 실행한 폴더는 IPC가 도구를 고정하므로 화면에서도 변경 차단
  const [toolLocked, setToolLocked] = useState(false);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [readiness, setReadiness] = useState<{
    userId: number;
    teamId: number;
    ready: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const [connections, setConnections] = useState<SavedConnection[]>([]);
  const [hasSavedConnections, setHasSavedConnections] = useState(false);
  const [guideBusy, setGuideBusy] = useState(false);
  const [mcpMode, setMcpMode] = useState<"automatic" | "manual">("automatic");
  const manualSetup =
    getDesktopApi()?.capabilities?.manualMcpSetup === 1 &&
    Boolean(
      setup.getGuide &&
        setup.inspect &&
        setup.listConnections &&
        setup.resume &&
        setup.resetContext,
    );
  const active = useRef(false);
  const operationVersion = useRef(0);
  const busy =
    view?.state === "picking" ||
    view?.state === "running" ||
    checking ||
    guideBusy;
  const { userId, teamId, email } = account;
  const shouldCheckStatus = presentation === "page" || view === null;
  const ready =
    readiness?.userId === userId && readiness.teamId === teamId
      ? readiness.ready
      : null;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    onReadyChange?.(ready);
  }, [ready, onReadyChange]);

  useEffect(() => {
    active.current = true;
    const operations = operationVersion;
    if (manualSetup) void setup.resetContext!().catch(() => {});
    const unsubscribe = setup.onProgress(({ step, status }) => {
      setProgress((previous) => ({ ...previous, [step]: status }));
    });
    return () => {
      active.current = false;
      operations.current++;
      unsubscribe();
      if (manualSetup) void setup.resetContext!().catch(() => {});
    };
  }, [setup, manualSetup, userId, teamId, email]);

  useEffect(() => {
    if (!shouldCheckStatus) return;
    let current = true;
    void getStatus({ userId, teamId, email })
      .then(({ exitCode, result, hasSavedConnections }) => {
        if (!current) return;
        // 구형 데스크톱 앱에서도 연결 관리로 들어갈 수 있게 유지한다.
        setHasSavedConnections(hasSavedConnections ?? true);
        if (exitCode !== 0) return;
        const data = result.data;
        const connected =
          data?.connection.setupReady === true &&
          data.teamId === String(teamId) &&
          data.userId === String(userId);
        setReadiness((previous) => ({
          userId,
          teamId,
          ready:
            connected ||
            (previous?.userId === userId &&
              previous.teamId === teamId &&
              previous.ready),
        }));
      })
      .catch(() => {
        if (current) setHasSavedConnections(true);
      });
    return () => {
      current = false;
    };
  }, [email, getStatus, shouldCheckStatus, teamId, userId]);

  function complete() {
    setReadiness({ userId, teamId, ready: true });
    setView({ state: "done" });
    onConnected?.();
    onRefreshAgents();
  }

  async function run(
    selection: ProjectSelection,
    tool: SetupTool,
    password?: string,
    mode = mcpMode,
  ) {
    if (busy) return;
    let metadata;
    try {
      metadata = createSetupAgentMetadata(agentPart, rolesText);
    } catch (error) {
      setMetadataError(messageFrom(error));
      setView({ state: "select-tool" });
      return;
    }
    setMetadataError("");
    setMcpMode(mode);
    const version = operationVersion.current;
    setSelectedTool(tool);
    setToolLocked(true);
    setProgress({});
    setNotice("");
    setView({ state: "running" });
    try {
      const result = await setup.run(
        selection.id,
        tool,
        password,
        metadata,
        manualSetup ? { mcpMode: mode } : undefined,
      );
      if (!active.current || version !== operationVersion.current) return;
      showResult(result);
    } catch (error) {
      if (active.current && version === operationVersion.current)
        setView({ state: "error", message: messageFrom(error) });
    }
  }

  function showResult(result: SetupResult) {
    if (result.state === "done") complete();
    else if (result.state === "manual" && manualSetup)
      setView({ state: "guide" });
    else setView(localizeSetupError(result));
  }

  async function issueToken() {
    if (!project || busy || !setup.issueToken) return;
    const version = operationVersion.current;
    setProgress({});
    setView({ state: "running" });
    try {
      const result = await setup.issueToken(project.id);
      if (active.current && version === operationVersion.current)
        showResult(result);
    } catch (error) {
      if (active.current && version === operationVersion.current)
        setView({ state: "error", message: messageFrom(error) });
    }
  }

  async function pickFolder() {
    const version = ++operationVersion.current;
    setProject(null);
    setSelectedTool(null);
    setToolLocked(false);
    setMcpMode("automatic");
    setAgentPart("");
    setRolesText("");
    setMetadataError("");
    setView({ state: "picking" });
    try {
      const selection = await setup.pickFolder(account);
      if (!active.current || version !== operationVersion.current) return;
      if (!selection) {
        setView({ state: "choose" });
        return;
      }
      setProject(selection);
      if (selection.tools.length === 0) {
        setView({
          state: "error",
          message:
            t("실행 가능한 Codex 또는 Claude Code를 찾지 못했습니다. 도구를 설치하거나 실행할 수 있는지 확인해주세요."),
        });
      } else {
        if (selection.tools.length === 1) setSelectedTool(selection.tools[0]);
        setView({ state: "select-tool" });
      }
    } catch (error) {
      if (active.current && version === operationVersion.current)
        setView({ state: "error", message: messageFrom(error) });
    }
  }

  function submitConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !selectedTool || busy) return;
    void run(project, selectedTool, undefined, "automatic");
  }

  async function openConnections() {
    const version = ++operationVersion.current;
    setProject(null);
    setSelectedTool(null);
    setChecking(true);
    setView({ state: "connections" });
    setNotice("");
    setConnections([]);
    try {
      const saved = await setup.listConnections!(account);
      if (active.current && version === operationVersion.current)
        setConnections(saved);
    } catch (error) {
      if (active.current && version === operationVersion.current)
        setNotice(messageFrom(error));
    } finally {
      if (active.current && version === operationVersion.current)
        setChecking(false);
    }
  }

  function markProjectReady() {
    setReadiness({ userId, teamId, ready: true });
    onRefreshAgents();
    onConnected?.();
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !selectedTool || busy) return;
    const form = event.currentTarget;
    const password = new FormData(form).get("password");
    form.reset();
    if (
      typeof password !== "string" ||
      !password ||
      new TextEncoder().encode(password).length > 72
    ) {
      setView({
        state: "password",
        message: t("비밀번호는 UTF-8 기준 72바이트 이하여야 합니다."),
      });
      return;
    }
    void run(project, selectedTool, password);
  }

  async function checkManual() {
    if (!project || !selectedTool || checking) return;
    setChecking(true);
    setNotice("");
    try {
      const confirmed = await setup.check(project.id);
      if (!active.current) return;
      if (confirmed) complete();
      else
        setNotice(
          t("아직 연결을 확인하지 못했습니다. 안내된 파일에 설정을 적용했는지 확인해주세요."),
        );
    } catch (error) {
      if (active.current) setNotice(messageFrom(error));
    } finally {
      if (active.current) setChecking(false);
    }
  }

  async function manualAction(action: () => Promise<void>, success: string) {
    try {
      await action();
      if (active.current) setNotice(success);
    } catch (error) {
      if (active.current) setNotice(messageFrom(error));
    }
  }

  function close() {
    if (busy) return;
    operationVersion.current++;
    setView(presentation === "page" ? { state: "choose" } : null);
    setProject(null);
    setSelectedTool(null);
    setToolLocked(false);
    setAgentPart("");
    setRolesText("");
    setMetadataError("");
    setNotice("");
  }

  const content = view && (
    <div className="project-connect-content">
      {project && view.state !== "done" && (
        <p className="project-connect-selection">
          <Icon name="grid" size={17} />
          {project.name}
          {selectedTool && <span>{setupToolNames[selectedTool]}</span>}
        </p>
      )}
      {view.state === "connections" && (
        <div className="grid gap-3">
          <p>{t("현재 계정·팀에서 이 PC에 준비한 프로젝트입니다. 설정을 여는 것만으로 연결 프로그램을 시작하거나 Agent를 생성하지 않습니다.")}</p>
          {checking && <p role="status">{t("프로젝트 목록을 읽고 있습니다…")}</p>}
          {!checking &&
            connections.map((connection) => (
              <button
                className="button button-secondary text-left"
                type="button"
                key={connection.id}
                onClick={() => {
                  setProject({
                    id: connection.id,
                    name: connection.name,
                    tools: [connection.tool],
                    saved: true,
                    authRequired: connection.availability === "auth_required",
                  });
                  setSelectedTool(connection.tool);
                  setView({ state: "guide" });
                }}
              >
                <span>
                  {connection.name} · {setupToolNames[connection.tool]} · Agent{" "}
                  {connection.agentId}
                  <br />
                  <span className="field-hint break-all">
                    {connection.projectPath}
                  </span>
                  <br />
                  <span className="field-hint">
                    {connection.availability === "auth_required"
                      ? t("로그인 만료 · 비밀번호 입력 후 재개")
                      : connection.availability !== "ready"
                        ? t("로컬 연결 준비 필요")
                        : connection.fileState === "matches"
                          ? t("설정 파일 일치")
                          : t("설정 확인 필요")}
                  </span>
                </span>
              </button>
            ))}
          {!checking && connections.length === 0 && !notice && (
            <p>{t("저장된 연결이 없습니다. Agent 목록의 ‘Agent 추가’에서 시작해주세요.")}</p>
          )}
          {notice && (
            <p role="alert" className="inline-error">
              {notice}
            </p>
          )}
        </div>
      )}
      {view.state === "guide" && project && (
        <McpGuideView
          key={project.id}
          setup={setup}
          id={project.id}
          authRequired={project.authRequired}
          onBusyChange={setGuideBusy}
          onReady={markProjectReady}
          onClose={close}
        />
      )}
      {(view.state === "choose" || view.state === "picking") && (
        <ProjectFolderPicker busy={busy} onPickFolder={() => { void pickFolder(); }} />
      )}
      {view.state === "select-tool" && project && (
        <ProjectConnectForm
          tools={project.tools}
          selectedTool={selectedTool}
          agentPart={agentPart}
          rolesText={rolesText}
          metadataError={metadataError}
          busy={busy}
          toolLocked={toolLocked}
          onSelectTool={setSelectedTool}
          onPartChange={(part) => {
            setAgentPart(part);
            setMetadataError("");
          }}
          onRolesChange={(roles) => {
            setRolesText(roles);
            setMetadataError("");
          }}
          onSubmit={submitConnection}
          onManualSetup={manualSetup ? () => {
            if (selectedTool) void run(project, selectedTool, undefined, "manual");
          } : undefined}
        />
      )}
      {view.state === "running" && (
        <ol
          className="project-connect-progress"
          aria-label={t("연결 진행 상태")}
          aria-live="polite"
        >
          {steps.map(({ label, keys }, index) => {
            const status = stepLabel(keys.map((key) => progress[key]));
            return (
              <li
                key={label}
                className={
                  status === "완료"
                    ? "is-complete"
                    : status === "진행 중"
                      ? "is-current"
                      : ""
                }
              >
                <span className="project-connect-step">
                  {status === "완료" ? (
                    <Icon name="check" size={16} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span>{t(label, { context: "step" })}</span>
                <span className="field-hint">{t(status)}</span>
              </li>
            );
          })}
        </ol>
      )}
      {view.state === "password" && (
        <form className="grid gap-4" onSubmit={submitPassword}>
          <p>{t("PC 연결을 위해 {{email}} 계정의 비밀번호를 한 번 더 확인합니다.", { email: account.email })}</p>
          <label className="field">{t("비밀번호")}<input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              autoFocus
            />
          </label>
          {view.message && (
            <p className="inline-error" role="alert">
              {view.message}
            </p>
          )}
          <div className="modal-footer">
            <button className="button button-primary" type="submit">{t("계속")}</button>
          </div>
        </form>
      )}
      {view.state === "token" && (
        <div className="grid gap-4">
          <p>{t("이 폴더에 연결된 Agent {{agentId}}의 연결 토큰이 이 PC에 없습니다. 새 토큰을 발급하면 연결을 이어서 진행해요.", { agentId: view.agentId })}</p>
          <p className="field-hint">{t("다른 PC에서 이 Agent로 연결해 두었다면 기존 토큰이 무효가 되어 그 연결은 끊어집니다.")}</p>
          <div className="modal-footer">
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={close}
            >{t("취소")}</button>
            <button
              className="button button-primary"
              type="button"
              disabled={busy || !setup.issueToken}
              onClick={() => void issueToken()}
            >{t("토큰 발급 후 연결")}</button>
          </div>
        </div>
      )}
      {view.state === "manual" && project && selectedTool && (
        <>
          <p>{t("아래 설정을 파일에 추가한 뒤 {{tool}}을 다시 열어주세요.", { tool: setupToolNames[selectedTool] })}</p>
          <p className="field-hint break-all">{view.targetPath}</p>
          <pre
            className="max-h-48 overflow-auto"
            aria-label={t("추가할 AI 도구 설정")}
          >
            {view.snippet}
          </pre>
          {notice && (
            <p className="field-hint" role="status">
              {notice}
            </p>
          )}
          <div className="modal-footer">
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                void manualAction(
                  () => copyText(view.snippet),
                  t("설정을 복사했습니다."),
                );
              }}
            >{t("설정 복사")}</button>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                void manualAction(() => setup.openConfigFolder(project.id), "");
              }}
            >{t("폴더 열기")}</button>
            <button
              className="button button-primary"
              type="button"
              disabled={busy}
              onClick={() => {
                void checkManual();
              }}
            >
              {checking ? t("연결 확인 중…") : t("설정 확인")}
            </button>
          </div>
        </>
      )}
      {view.state === "done" && (
        <>
          <ProjectConnectSummary
            projectName={project?.name}
            selectedTool={selectedTool}
            teamName={teamName}
            showCompletion={presentation === "modal"}
          />
          <div className="modal-footer">
            <button
              className="button button-primary"
              type="button"
              onClick={presentation === "page" ? onFinish : close}
            >
              {presentation === "page" ? t("대시보드로 이동") : t("닫기")}
              {presentation === "page" && <Icon name="arrow" size={16} />}
            </button>
          </div>
        </>
      )}
      {view.state === "error" && (
        <>
          <p className="inline-error" role="alert">
            {view.message}
          </p>
          {view.code && (
            <details className="field-hint">
              <summary>{t("자세히")}</summary>
              {view.code}
            </details>
          )}
          <div className="modal-footer">
            {project &&
              selectedTool &&
              view.code === "SETUP_AGENT_BINDING_CONFLICT" &&
              Boolean(agentPart || rolesText.trim()) && (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => setView({ state: "select-tool" })}
                >{t("담당 정보 다시 입력")}</button>
              )}
            {project &&
              selectedTool &&
              !noRetryCodes.includes(view.code ?? "") && (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => {
                    void run(project, selectedTool);
                  }}
                >{t("다시 시도")}</button>
              )}
            {view.code === "SETUP_REGISTRATION_UNKNOWN" ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  if (presentation === "page") onOpenDashboard?.();
                  else {
                    close();
                    onRefreshAgents();
                  }
                }}
              >{t("Agent 목록 확인")}</button>
            ) : (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setProject(null);
                  setSelectedTool(null);
                  setView({ state: "choose" });
                }}
              >{t("폴더 다시 선택")}</button>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (presentation === "page") return content;
  return (
    <div className="section-actions">
      {!onReadyChange && ready !== null && (
        <span
          className={`badge ${ready ? "badge-online" : "badge-offline"}`}
          role="status"
        >
          PC: {ready ? t("연결", { context: "status" }) : t("미연결")}
        </span>
      )}
      {manualSetup && hasSavedConnections && (
        <button
          className="button button-secondary"
          type="button"
          disabled={busy}
          onClick={() => void openConnections()}
        >{t("연결 관리")}</button>
      )}
      <button
        className="button button-primary"
        type="button"
        disabled={busy}
        onClick={() => setView({ state: "choose" })}
      >
        <Icon name="plus" size={18} />{" "}{t("Agent 추가")}</button>
      {view && (
        <Modal
          title={
            view.state === "guide"
              ? t("AI 도구 직접 설정")
              : view.state === "connections"
                ? t("연결 관리")
                : t("Agent 추가")
          }
          description={t("{{teamName}} 팀의 이 PC 프로젝트 설정입니다.", { teamName })}
          onClose={close}
          busy={busy}
        >
          {content}
        </Modal>
      )}
    </div>
  );
}
