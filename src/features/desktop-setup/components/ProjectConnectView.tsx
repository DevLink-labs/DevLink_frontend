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
} from "../api/desktopApi";

interface ProjectConnectViewProps {
  setup: DesktopSetupApi;
  getStatus: (account: SetupAccount) => Promise<DesktopStatus>;
  account: SetupAccount;
  teamName: string;
  onRefreshAgents: () => void;
  presentation?: "modal" | "page";
  onBusyChange?: (busy: boolean) => void;
  onConnected?: () => void;
  onFinish?: () => void;
  onOpenDashboard?: () => void;
}

type View =
  | { state: "choose" | "picking" | "select-tool" | "running" }
  | SetupResult;

const toolNames: Record<SetupTool, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
};

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
  if (!(error instanceof Error)) return "프로젝트 연결 중 오류가 발생했습니다.";
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
  onConnected,
  onFinish,
  onOpenDashboard,
}: ProjectConnectViewProps) {
  const [view, setView] = useState<View | null>(
    presentation === "page" ? { state: "choose" } : null,
  );
  const [project, setProject] = useState<ProjectSelection | null>(null);
  const [selectedTool, setSelectedTool] = useState<SetupTool | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [readiness, setReadiness] = useState<{
    userId: number;
    teamId: number;
    ready: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const active = useRef(false);
  const busy =
    view?.state === "picking" || view?.state === "running" || checking;
  const { userId, teamId, email } = account;
  const ready =
    readiness?.userId === userId && readiness.teamId === teamId
      ? readiness.ready
      : null;

  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  useEffect(() => {
    active.current = true;
    const unsubscribe = setup.onProgress(({ step, status }) => {
      setProgress((previous) => ({ ...previous, [step]: status }));
    });
    return () => {
      active.current = false;
      unsubscribe();
    };
  }, [setup]);

  useEffect(() => {
    let current = true;
    void getStatus({ userId, teamId, email })
      .then(({ exitCode, result }) => {
        if (!current || exitCode !== 0) return;
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
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [email, getStatus, teamId, userId]);

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
  ) {
    setSelectedTool(tool);
    setProgress({});
    setNotice("");
    setView({ state: "running" });
    try {
      const result = await setup.run(selection.id, tool, password);
      if (!active.current) return;
      if (result.state === "done") complete();
      else setView(result);
    } catch (error) {
      if (active.current)
        setView({ state: "error", message: messageFrom(error) });
    }
  }

  async function pickFolder() {
    setProject(null);
    setSelectedTool(null);
    setView({ state: "picking" });
    try {
      const selection = await setup.pickFolder(account);
      if (!active.current) return;
      if (!selection) {
        setView({ state: "choose" });
        return;
      }
      setProject(selection);
      if (selection.tools.length === 0) {
        setView({
          state: "error",
          message:
            "실행 가능한 Codex 또는 Claude Code를 찾지 못했습니다. 도구를 설치하거나 실행할 수 있는지 확인해주세요.",
        });
      } else if (selection.tools.length === 1) {
        await run(selection, selection.tools[0]);
      } else {
        setView({ state: "select-tool" });
      }
    } catch (error) {
      if (active.current)
        setView({ state: "error", message: messageFrom(error) });
    }
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
        message: "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.",
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
          "아직 연결을 확인하지 못했습니다. 안내된 파일에 설정을 적용했는지 확인해주세요.",
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
    setView(presentation === "page" ? { state: "choose" } : null);
    setProject(null);
    setSelectedTool(null);
    setNotice("");
  }

  const content = view && (
    <div className="project-connect-content">
      {project && view.state !== "done" && (
        <p className="project-connect-selection">
          <Icon name="grid" size={17} />
          {project.name}
          {selectedTool && <span>{toolNames[selectedTool]}</span>}
        </p>
      )}
      {(view.state === "choose" || view.state === "picking") && (
        <>
          <div className="project-connect-folder">
            <span className="project-connect-symbol">
              <Icon name="grid" size={26} />
            </span>
            <h3>이 PC에서 작업할 폴더를 선택하세요</h3>
            <p>
              폴더와 AI 도구를 선택하면 Agent 등록과 연결 설정을 함께 진행해요.
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="button button-primary"
              type="button"
              disabled={busy}
              onClick={() => {
                void pickFolder();
              }}
            >
              {busy ? "폴더 선택 및 도구 확인 중…" : "폴더 선택"}
            </button>
          </div>
        </>
      )}
      {view.state === "select-tool" && project && (
        <>
          <p>이 프로젝트에 연결할 AI 도구를 선택해주세요.</p>
          <div className="project-connect-tools">
            {project.tools.map((tool) => (
              <button
                key={tool}
                className="project-connect-tool"
                type="button"
                onClick={() => {
                  void run(project, tool);
                }}
              >
                <Icon name="agent" size={23} />
                <strong>{toolNames[tool]}</strong>
                <span>이 PC에서 사용 가능</span>
                <Icon name="arrow" size={17} />
              </button>
            ))}
          </div>
        </>
      )}
      {view.state === "running" && (
        <ol
          className="project-connect-progress"
          aria-label="연결 진행 상태"
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
                <span>{label}</span>
                <span className="field-hint">{status}</span>
              </li>
            );
          })}
        </ol>
      )}
      {view.state === "password" && (
        <form className="grid gap-4" onSubmit={submitPassword}>
          <p>
            이 PC 연결을 위해 {account.email} 계정의 비밀번호를 한 번 더
            확인합니다.
          </p>
          <label className="field">
            비밀번호
            <input
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
            <button className="button button-primary" type="submit">
              계속
            </button>
          </div>
        </form>
      )}
      {view.state === "manual" && project && selectedTool && (
        <>
          <p>
            아래 설정을 파일에 추가한 뒤 {toolNames[selectedTool]}을 다시
            열어주세요.
          </p>
          <p className="field-hint break-all">{view.targetPath}</p>
          <pre
            className="max-h-48 overflow-auto"
            aria-label="추가할 AI 도구 설정"
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
                  "설정을 복사했습니다.",
                );
              }}
            >
              설정 복사
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => {
                void manualAction(() => setup.openConfigFolder(project.id), "");
              }}
            >
              폴더 열기
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={busy}
              onClick={() => {
                void checkManual();
              }}
            >
              {checking ? "연결 확인 중…" : "적용했어요, 다시 확인"}
            </button>
          </div>
        </>
      )}
      {view.state === "done" && (
        <>
          {presentation === "modal" && (
            <div className="project-connect-complete" role="status">
              <span className="project-connect-symbol">
                <Icon name="check" size={27} />
              </span>
              <h3>프로젝트 연결을 완료했습니다</h3>
              <p>AI 도구에서 마지막 안내를 확인해주세요.</p>
            </div>
          )}
          {project && selectedTool && (
            <dl className="project-connect-summary">
              <div>
                <dt>프로젝트</dt>
                <dd>{project.name}</dd>
              </div>
              <div>
                <dt>AI 도구</dt>
                <dd>{toolNames[selectedTool]}</dd>
              </div>
              <div>
                <dt>팀</dt>
                <dd>{teamName}</dd>
              </div>
            </dl>
          )}
          {selectedTool === "codex" && (
            <p>
              Codex에서 이 프로젝트를 열고 폴더 신뢰 여부를 묻는다면 신뢰를
              선택해주세요.
            </p>
          )}
          {selectedTool === "claude-code" && (
            <p>
              Claude Code에서 이 프로젝트를 열고 DevLink MCP 사용을 묻는다면
              승인해주세요.
            </p>
          )}
          <div className="modal-footer">
            <button
              className="button button-primary"
              type="button"
              onClick={presentation === "page" ? onFinish : close}
            >
              {presentation === "page" ? "대시보드로 이동" : "닫기"}
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
              <summary>자세히</summary>
              {view.code}
            </details>
          )}
          <div className="modal-footer">
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
              >
                Agent 목록 확인
              </button>
            ) : (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setProject(null);
                  setSelectedTool(null);
                  setView({ state: "choose" });
                }}
              >
                폴더 다시 선택
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  if (presentation === "page") return content;
  return (
    <div className="section-actions">
      {ready !== null && (
        <span
          className={`badge ${ready ? "badge-online" : "badge-offline"}`}
          role="status"
        >
          이 PC: {ready ? "연결됨" : "설정 필요"}
        </span>
      )}
      <button
        className="button button-secondary"
        type="button"
        onClick={() => setView({ state: "choose" })}
      >
        이 PC 연결
      </button>
      {view && (
        <Modal
          title="이 PC 연결"
          description={`${teamName} 팀에 이 PC의 프로젝트를 연결합니다.`}
          onClose={close}
          busy={busy}
        >
          {content}
        </Modal>
      )}
    </div>
  );
}
