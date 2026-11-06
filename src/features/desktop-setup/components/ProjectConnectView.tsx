import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Modal } from "@/components/ui";
import { copyText } from "@/utils";
import type { DesktopSetupApi, DesktopStatus, ProjectSelection, SetupAccount, SetupResult, SetupTool } from "../api/desktopApi";

interface ProjectConnectViewProps {
  setup: DesktopSetupApi;
  getStatus: () => Promise<DesktopStatus>;
  account: SetupAccount;
  teamName: string;
  onRefreshAgents: () => void;
}

type View = { state: "choose" | "picking" | "select-tool" | "running" } | SetupResult;

const toolNames: Record<SetupTool, string> = { codex: "Codex", "claude-code": "Claude Code" };

const steps = [
  { label: "계정 확인", keys: ["validate", "authenticate"] },
  { label: "팀·프로젝트 확인", keys: ["select_team", "bind_project"] },
  { label: "AI 도구·Agent 확인", keys: ["select_tool", "register_agent"] },
  { label: "연결", keys: ["start_broker", "configure_mcp", "verify_connection"] },
];

function stepLabel(statuses: (string | undefined)[]) {
  if (statuses.some((status) => status === "failed")) return "오류";
  if (statuses.every((status) => status === "succeeded")) return "완료";
  if (statuses.some(Boolean)) return "진행 중";
  return "대기";
}

function messageFrom(error: unknown) {
  if (!(error instanceof Error)) return "프로젝트 연결 중 오류가 발생했습니다.";
  return error.message.replace(/^Error invoking remote method '[^']+': Error: /, "");
}

export default function ProjectConnectView({ setup, getStatus, account, teamName, onRefreshAgents }: ProjectConnectViewProps) {
  const [view, setView] = useState<View | null>(null);
  const [project, setProject] = useState<ProjectSelection | null>(null);
  const [selectedTool, setSelectedTool] = useState<SetupTool | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [ready, setReady] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const active = useRef(false);
  const busy = view?.state === "picking" || view?.state === "running" || checking;
  const { userId, teamId } = account;

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
    void getStatus().then(({ exitCode, result }) => {
      if (!current || exitCode !== 0) return;
      const data = result.data;
      const connected = data?.connection.setupReady === true && data.teamId === String(teamId) && data.userId === String(userId);
      setReady((previous) => previous === true || connected);
    }).catch(() => {});
    return () => { current = false; };
  }, [getStatus, teamId, userId]);

  function complete() {
    setReady(true);
    setView({ state: "done" });
    onRefreshAgents();
  }

  async function run(selection: ProjectSelection, tool: SetupTool, password?: string) {
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
      if (active.current) setView({ state: "error", message: messageFrom(error) });
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
        setView({ state: "error", message: "실행 가능한 Codex 또는 Claude Code를 찾지 못했습니다. 도구를 설치하거나 실행할 수 있는지 확인해주세요." });
      } else if (selection.tools.length === 1) {
        await run(selection, selection.tools[0]);
      } else {
        setView({ state: "select-tool" });
      }
    } catch (error) {
      if (active.current) setView({ state: "error", message: messageFrom(error) });
    }
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !selectedTool || busy) return;
    const form = event.currentTarget;
    const password = new FormData(form).get("password");
    form.reset();
    if (typeof password !== "string" || !password || new TextEncoder().encode(password).length > 72) {
      setView({ state: "password", message: "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다." });
      return;
    }
    void run(project, selectedTool, password);
  }

  async function checkManual() {
    if (!project || checking) return;
    setChecking(true);
    setNotice("");
    try {
      const confirmed = await setup.check(project.id);
      if (!active.current) return;
      if (confirmed) complete();
      else setNotice("아직 연결을 확인하지 못했습니다. 안내된 파일에 설정을 적용했는지 확인해주세요.");
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
    setView(null);
    setProject(null);
    setSelectedTool(null);
    setNotice("");
  }

  return (
    <div className="section-actions">
      {ready !== null && (
        <span className={`badge ${ready ? "badge-online" : "badge-offline"}`} role="status">
          이 PC: {ready ? "연결됨" : "설정 필요"}
        </span>
      )}
      <button className="button button-secondary" type="button" onClick={() => setView({ state: "choose" })}>
        이 PC 연결
      </button>

      {view && (
        <Modal title="이 PC 연결" description={`${teamName} 팀에 이 PC의 프로젝트를 연결합니다.`} onClose={close} busy={busy}>
          <div className="grid gap-4">
            {project && <p className="field-hint">프로젝트 {project.name}{selectedTool && ` · ${toolNames[selectedTool]}`}</p>}
            {(view.state === "choose" || view.state === "picking") && (
              <>
                <p>연결할 프로젝트의 루트 폴더를 선택해주세요.</p>
                <div className="modal-footer">
                  <button className="button button-primary" type="button" disabled={busy} onClick={() => { void pickFolder(); }}>
                    {busy ? "폴더 선택 및 도구 확인 중…" : "폴더 선택"}
                  </button>
                </div>
              </>
            )}
            {view.state === "select-tool" && project && (
              <>
                <p>이 프로젝트에 연결할 AI 도구를 선택해주세요.</p>
                <div className="modal-footer">
                  {project.tools.map((tool) => (
                    <button key={tool} className="button button-secondary" type="button" onClick={() => { void run(project, tool); }}>
                      {toolNames[tool]}
                    </button>
                  ))}
                </div>
              </>
            )}
            {view.state === "running" && (
              <ol className="grid gap-2" aria-label="연결 진행 상태" aria-live="polite">
                {steps.map(({ label, keys }) => (
                  <li key={label} className="flex items-center justify-between">
                    <span>{label}</span><span className="field-hint">{stepLabel(keys.map((key) => progress[key]))}</span>
                  </li>
                ))}
              </ol>
            )}
            {view.state === "password" && (
              <form className="grid gap-4" onSubmit={submitPassword}>
                <p>이 PC 연결을 위해 {account.email} 계정의 비밀번호를 한 번 더 확인합니다.</p>
                <label className="field">비밀번호<input type="password" name="password" autoComplete="current-password" required autoFocus /></label>
                {view.message && <p className="inline-error" role="alert">{view.message}</p>}
                <div className="modal-footer"><button className="button button-primary" type="submit">계속</button></div>
              </form>
            )}
            {view.state === "manual" && project && selectedTool && (
              <>
                <p>아래 설정을 파일에 추가한 뒤 {toolNames[selectedTool]}을 다시 열어주세요.</p>
                <p className="field-hint break-all">{view.targetPath}</p>
                <pre className="max-h-48 overflow-auto" aria-label="추가할 AI 도구 설정">{view.snippet}</pre>
                {notice && <p className="field-hint" role="status">{notice}</p>}
                <div className="modal-footer">
                  <button className="button button-secondary" type="button" disabled={busy} onClick={() => { void manualAction(() => copyText(view.snippet), "설정을 복사했습니다."); }}>설정 복사</button>
                  <button className="button button-secondary" type="button" disabled={busy} onClick={() => { void manualAction(() => setup.openConfigFolder(project.id), ""); }}>폴더 열기</button>
                  <button className="button button-primary" type="button" disabled={busy} onClick={() => { void checkManual(); }}>
                    {checking ? "연결 확인 중…" : "적용했어요, 다시 확인"}
                  </button>
                </div>
              </>
            )}
            {view.state === "done" && (
              <>
                <p role="status">연결을 완료했습니다.</p>
                {selectedTool === "codex" && <p>Codex에서 이 프로젝트를 열고 폴더 신뢰 여부를 묻는다면 신뢰를 선택해주세요.</p>}
                {selectedTool === "claude-code" && <p>Claude Code에서 이 프로젝트를 열고 DevLink MCP 사용을 묻는다면 승인해주세요.</p>}
                <div className="modal-footer"><button className="button button-primary" type="button" onClick={close}>닫기</button></div>
              </>
            )}
            {view.state === "error" && (
              <>
                <p className="inline-error" role="alert">{view.message}</p>
                {view.code && <details className="field-hint"><summary>자세히</summary>{view.code}</details>}
                <div className="modal-footer">
                  {view.code === "SETUP_REGISTRATION_UNKNOWN" ? (
                    <button className="button button-secondary" type="button" onClick={() => { close(); onRefreshAgents(); }}>Agent 목록 확인</button>
                  ) : (
                    <button className="button button-secondary" type="button" onClick={() => { setProject(null); setSelectedTool(null); setView({ state: "choose" }); }}>폴더 다시 선택</button>
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
