import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { copyText } from "@/utils";
import type {
  DesktopSetupApi,
  McpGuide,
  SetupInspection,
} from "../api/desktopApi";
import { localizeSetupError } from "../lib/setupErrors";

interface Props {
  setup: DesktopSetupApi;
  id: string;
  authRequired?: boolean;
  onBusyChange: (busy: boolean) => void;
  onReady: () => void;
}

const usagePrompt =
  "이 프로젝트에서 DevLink의 register_agent로 현재 Agent를 연결하고, list_agents로 팀 Agent 목록을 확인해주세요. 코드 수정이나 작업 생성은 하지 마세요.";

function instructions(guide: McpGuide) {
  if (guide.availability !== "ready")
    return "로컬 연결 준비가 필요합니다. 연결을 재개하거나 앱의 런타임·자격 파일을 복구한 뒤 다시 확인해주세요.";
  if (guide.fileState === "invalid")
    return "기존 파일의 문법 또는 중복 키를 먼저 수정해주세요. 파일 전체를 새 설정으로 덮어쓰지 마세요.";
  if (guide.fileState === "matches")
    return "이미 이 프로젝트의 설정이 들어 있습니다. 아래에서 설정과 AI 도구 사용 상태를 확인해주세요.";
  if (guide.fileState === "file_missing")
    return "안내된 경로의 폴더와 파일을 만들고 새 파일 전체 설정을 붙여 넣으세요.";
  if (guide.reason === "edit_inline_container")
    return "기존 파일을 백업한 뒤 mcp_servers의 중괄호 안에 DevLink 항목을 넣으세요. 기존 devlink가 있으면 해당 항목만 교체하고, 다른 항목과 쉼표를 유지하세요.";
  if (guide.reason === "merge_json_property")
    return guide.editKind === "add_container"
      ? "기존 파일을 백업하고 루트 중괄호 안에 mcpServers 속성을 추가하세요. 다른 속성과 쉼표를 유지하세요."
      : "기존 파일을 백업하고 mcpServers 중괄호 안에 devlink 속성을 추가하거나 교체하세요. 다른 서버와 쉼표를 유지하고 같은 키를 중복 추가하지 마세요.";
  return guide.fileState === "different"
    ? "기존 파일을 백업하고 DevLink 항목과 그 하위 env만 현재 팀·Agent의 설정으로 교체하세요. 추가 옵션을 검토하고 다른 서버와 프로젝트 설정은 유지하세요."
    : "기존 파일을 백업하고 DevLink 테이블 블록을 추가하세요. 다른 MCP 서버와 프로젝트 설정은 유지하세요.";
}

function statusLabel(inspection: SetupInspection | null, guide: McpGuide) {
  const connection = inspection?.connection;
  if (connection?.hostSession === "conflict") return "다른 세션과 충돌";
  if (guide.fileState === "invalid" || guide.fileState === "unavailable")
    return "설정 확인 필요";
  if (guide.fileState !== "matches") return "설정 적용 필요";
  if (!connection) return "설정 파일 일치 · 로컬 연결 상태 확인 필요";
  if (!connection.setupReady) return "로컬 연결 준비 필요";
  return connection.collaborationReady === true &&
    connection.hostSession === "bound"
    ? "AI 도구 연결 확인됨"
    : "설정 완료 · AI 도구 확인 전";
}

function observationLabel(value: string) {
  const labels: Record<string, string> = {
    running: "실행 중",
    stopped: "중지됨",
    unhealthy: "연결 프로그램 점검 필요",
    connected: "연결됨",
    disconnected: "미연결",
    connecting: "연결 중",
    verified: "확인됨",
    unauthenticated: "인증 필요",
    mismatch: "정보 불일치",
    valid: "준비됨",
    missing: "준비 필요",
    invalid: "복구 필요",
    bound: "연결 확인됨",
    unbound: "사용 확인 전",
    conflict: "다른 세션과 충돌",
    not_checked: "확인 전",
    unknown: "확인 불가",
  };
  return labels[value] ?? "확인 필요";
}

export default function McpGuideView({
  setup,
  id,
  authRequired = false,
  onBusyChange,
  onReady,
}: Props) {
  const [guide, setGuide] = useState<McpGuide | null>(null);
  const [inspection, setInspection] = useState<SetupInspection | null>(null);
  const [busy, setBusy] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(authRequired);
  const [notice, setNotice] = useState("");
  const generation = useRef(0);

  useEffect(() => {
    const version = ++generation.current;
    // 로그인 만료 연결은 비밀번호로 재개한 뒤 안내 조회
    if (!authRequired)
      void setup.getGuide!(id)
        .then((data) => {
          if (version === generation.current) setGuide(data);
        })
        .catch(() => {
          if (version === generation.current)
            setNotice(
              "설정을 읽지 못했습니다. 프로젝트 설정을 다시 선택하거나 연결 프로필을 확인해주세요.",
            );
        });
    return () => {
      generation.current = version + 1;
    };
  }, [authRequired, id, setup]);

  useEffect(() => {
    onBusyChange(busy);
  }, [busy, onBusyChange]);

  async function action(operation: () => Promise<void>) {
    if (busy) return;
    const version = generation.current;
    setBusy(true);
    setNotice("");
    setInspection(null);
    try {
      await operation();
    } catch (error) {
      if (version === generation.current)
        setNotice(
          error instanceof Error
            ? error.message.replace(
                /^Error invoking remote method '[^']+': Error: /,
                "",
              )
            : "설정을 확인하지 못했습니다.",
        );
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }

  async function inspect() {
    const version = generation.current;
    const result = await setup.inspect!(id);
    if (version !== generation.current) return;
    setGuide(result.guide);
    setInspection(result);
    if (result.guide.fileState === "matches" && result.connection?.setupReady)
      onReady();
  }

  async function resume(password?: string) {
    const version = generation.current;
    const result = localizeSetupError(await setup.resume!(id, password));
    if (version !== generation.current) return;
    setPasswordRequired(result.state === "password");
    if (result.state === "error" || result.state === "password") {
      if (result.message) setNotice(result.message);
      return;
    }
    await inspect();
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password");
    event.currentTarget.reset();
    if (
      typeof password !== "string" ||
      !password ||
      new TextEncoder().encode(password).length > 72
    ) {
      setNotice("비밀번호는 UTF-8 기준 72바이트 이하여야 합니다.");
      return;
    }
    void action(() => resume(password));
  }

  return (
    <div className="grid gap-4">
      {guide && (
        <>
          <p className="field-hint break-all">
            {guide.projectPath} · Agent {guide.agentId}
          </p>
          <p className="break-all">{guide.targetPath}</p>
          <p>{instructions(guide)}</p>
          {guide.automaticSupported === false && (
            <p className="field-hint">
              이 버전의 자동 적용은 검증되지 않았습니다. 안내된 설정 형식으로
              직접 적용한 뒤 AI 도구에서 확인해주세요.
            </p>
          )}
          {guide.fileState === "different" && (
            <p className="field-hint">
              같은 폴더의 DevLink 항목에는 한 계정·팀의 연결만 적용할 수
              있습니다. 변경 후 AI 도구를 재시작해주세요.
            </p>
          )}
          <div className="section-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={busy || guide.availability !== "ready"}
              onClick={() => void action(() => copyText(guide.targetPath))}
            >
              경로 복사
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy || guide.availability !== "ready"}
              onClick={() => void action(() => setup.openConfigFolder(id))}
            >
              폴더 열기
            </button>
          </div>
          {guide.copyItems.map((item) => (
            <div key={item.scope} className="grid gap-2">
              <strong>{item.title}</strong>
              <pre
                className="max-h-48 overflow-auto whitespace-pre-wrap break-all"
                aria-label={item.title}
              >
                {item.snippet}
              </pre>
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const version = generation.current;
                    const latest = await setup.getGuide!(id);
                    if (version !== generation.current) return;
                    setGuide(latest);
                    const copy = latest.copyItems.find(
                      (next) => next.scope === item.scope,
                    );
                    if (!copy || copy.snippet !== item.snippet) {
                      setNotice(
                        "파일 상태가 변경됐습니다. 최신 안내를 확인한 뒤 다시 복사해주세요.",
                      );
                      return;
                    }
                    await copyText(copy.snippet);
                  })
                }
              >
                설정 복사
              </button>
            </div>
          ))}
          <p className="field-hint">
            이 설정은 현재 PC·계정용입니다. 팀원에게 공용 설정으로 배포하거나
            비밀값과 함께 공유하지 마세요.
          </p>
          <p role="status">
            <strong>{statusLabel(inspection, guide)}</strong>
          </p>
          {inspection?.connection && (
            <dl className="project-connect-summary">
              <div>
                <dt>로컬 연결 프로그램</dt>
                <dd>{observationLabel(inspection.connection.broker)}</dd>
              </div>
              <div>
                <dt>중앙 연결 / 신원 / 자격</dt>
                <dd>
                  {observationLabel(inspection.connection.central)} /{" "}
                  {observationLabel(inspection.connection.identity)} /{" "}
                  {observationLabel(inspection.connection.credentials)}
                </dd>
              </div>
              <div>
                <dt>AI 도구 세션</dt>
                <dd>{observationLabel(inspection.connection.hostSession)}</dd>
              </div>
            </dl>
          )}
          <p className="field-hint">
            확인 시각:{" "}
            {new Date(
              inspection?.connection?.observedAt ?? guide.observedAt,
            ).toLocaleString()}
          </p>
          <div className="section-actions">
            <button
              className="button button-primary"
              type="button"
              disabled={busy}
              onClick={() => void action(inspect)}
            >
              {busy ? "확인 중…" : "설정 확인"}
            </button>
            {(!inspection?.connection?.setupReady ||
              guide.availability !== "ready") && (
              <button
                className="button button-secondary"
                type="button"
                disabled={busy}
                onClick={() => void action(() => resume())}
              >
                연결 재개
              </button>
            )}
          </div>
          <p>
            이 프로젝트를{" "}
            {guide.toolType === "codex"
              ? "Codex에서 열고 폴더 신뢰를 허용"
              : "Claude Code에서 열고 프로젝트 MCP 사용을 승인"}
            해주세요. 설정 변경 후 AI 도구를 재시작하고 다음 요청을 전달하세요.
          </p>
          <p className="field-hint">{usagePrompt}</p>
          <div className="section-actions">
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => void action(() => copyText(usagePrompt))}
            >
              확인 요청 복사
            </button>
            <button
              className="button button-secondary"
              type="button"
              disabled={busy}
              onClick={() => void action(inspect)}
            >
              사용 상태 확인
            </button>
          </div>
          {inspection?.connection?.setupReady &&
            inspection.connection.collaborationReady !== true && (
              <p>
                설정은 준비됐습니다. AI 도구 사용 여부는 아직 확인되지
                않았습니다. 지금 닫고 나중에 확인할 수 있습니다.
              </p>
            )}
        </>
      )}
      {!guide && !notice && (
        <p role="status">
          {passwordRequired
            ? "이 PC의 DevLink 로그인이 만료됐습니다. 현재 계정 비밀번호를 입력해 연결을 재개해주세요."
            : "프로젝트 설정을 읽고 있습니다…"}
        </p>
      )}
      {passwordRequired && (
        <form className="grid gap-2" onSubmit={submitPassword}>
          <label className="field">
            현재 계정 비밀번호
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            연결 재개 계속
          </button>
        </form>
      )}
      {notice && (
        <p className="field-hint" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
