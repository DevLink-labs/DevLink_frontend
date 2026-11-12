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
  onClose: () => void;
}

const usagePrompt =
  "이 프로젝트에서 DevLink의 register_agent로 현재 Agent를 연결하고, list_agents로 팀 Agent 목록을 확인해주세요. 코드 수정이나 작업 생성은 하지 마세요.";

function configInstructions(guide: McpGuide) {
  if (guide.fileState === "invalid")
    return "기존 파일의 문법 또는 중복 키를 먼저 수정해주세요. 파일 전체를 새 설정으로 덮어쓰지 마세요.";
  if (guide.fileState === "unavailable")
    return "설정 파일을 읽을 수 없습니다. 파일 위치와 접근 권한을 확인해주세요.";
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

function getSetupStep(
  guide: McpGuide | null,
  inspection: SetupInspection | null,
) {
  const connection = inspection?.connection;
  if (connection?.hostSession === "conflict") return "conflict";
  if (guide?.availability === "needs_preparation") return "resume";
  if (guide?.fileState !== "matches") return "config";
  if (!inspection) return "check";
  if (!connection?.setupReady) return "resume";
  return connection.collaborationReady === true &&
    connection.hostSession === "bound"
    ? "connected"
    : "connect";
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
  onClose,
}: Props) {
  const [guide, setGuide] = useState<McpGuide | null>(null);
  const [inspection, setInspection] = useState<SetupInspection | null>(null);
  const [busy, setBusy] = useState(false);
  const [passwordRequired, setPasswordRequired] = useState(authRequired);
  const [tokenAgentId, setTokenAgentId] = useState("");
  const [notice, setNotice] = useState("");
  const generation = useRef(0);
  const connection = inspection?.connection;
  const step = getSetupStep(guide, inspection);
  const statusLabels = {
    config:
      guide?.fileState === "invalid" || guide?.fileState === "unavailable"
        ? "설정 확인 필요"
        : "설정 적용 필요",
    resume: "로컬 연결 준비 필요",
    check: "설정 파일 일치 · 로컬 연결 상태 확인 필요",
    connect: "설정 완료 · AI 도구 확인 전",
    connected: "AI 도구 연결 확인됨",
    conflict: "다른 세션과 충돌",
  };

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

  async function resume(password?: string, issueToken = false) {
    const version = generation.current;
    const result = localizeSetupError(
      issueToken
        ? await setup.issueToken!(id)
        : await setup.resume!(id, password),
    );
    if (version !== generation.current) return;
    setPasswordRequired(result.state === "password");
    setTokenAgentId(result.state === "token" ? result.agentId : "");
    if (result.state === "token") return;
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
      {guide && !passwordRequired && !tokenAgentId && (
        <>
          <p className="field-hint break-all">
            {guide.projectPath} · Agent {guide.agentId}
          </p>
          <p role="status">
            <strong>{statusLabels[step]}</strong>
          </p>
          {step === "config" && (
            <>
              <p className="break-all">{guide.targetPath}</p>
              <p>{configInstructions(guide)}</p>
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
                  disabled={busy}
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
                        if (
                          latest.fileState !== guide.fileState ||
                          latest.availability !== guide.availability
                        )
                          setInspection(null);
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
            </>
          )}
          {step === "resume" && (
            <p>이 프로젝트에서 사용하던 DevLink 연결을 다시 준비해주세요.</p>
          )}
          {step === "conflict" && (
            <p>이 Agent를 사용 중인 다른 AI 도구가 있는지 확인해주세요.</p>
          )}
          {step === "connect" && (
            <>
              <p>
                {guide.toolType === "codex"
                  ? "Codex에서 이 프로젝트를 열고 폴더 신뢰를 허용해주세요."
                  : "Claude Code에서 이 프로젝트를 열고 프로젝트 MCP 사용을 승인해주세요."}{" "}
                설정을 변경했다면 도구를 재시작한 뒤, 아래 요청을 채팅에 보내세요.
              </p>
              <p className="field-hint">{usagePrompt}</p>
            </>
          )}
          {step !== "connected" && (
            <div className="section-actions">
              {step === "connect" && (
                <button
                  className="button button-secondary"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      const version = generation.current;
                      await copyText(usagePrompt);
                      if (version === generation.current)
                        setNotice(
                          "요청을 복사했어요. AI 도구의 채팅에 붙여넣어 보내세요.",
                        );
                    })
                  }
                >
                  확인 요청 복사
                </button>
              )}
              <button
                className="button button-primary"
                type="button"
                disabled={busy}
                onClick={() =>
                  void action(step === "resume" ? () => resume() : inspect)
                }
              >
                {step === "resume"
                  ? "연결 재개"
                  : step === "config"
                    ? "설정 확인"
                    : "AI 도구 연결 확인"}
              </button>
            </div>
          )}
          {inspection && (
            <details className="field-hint">
              <summary>연결 상태 자세히 보기</summary>
              {connection && (
                <dl className="project-connect-summary">
                  <div>
                    <dt>로컬 연결 프로그램</dt>
                    <dd>{observationLabel(connection.broker)}</dd>
                  </div>
                  <div>
                    <dt>중앙 연결 / 신원 / 자격</dt>
                    <dd>
                      {observationLabel(connection.central)} /{" "}
                      {observationLabel(connection.identity)} /{" "}
                      {observationLabel(connection.credentials)}
                    </dd>
                  </div>
                  <div>
                    <dt>AI 도구 세션</dt>
                    <dd>{observationLabel(connection.hostSession)}</dd>
                  </div>
                </dl>
              )}
              <p>
                확인 시각:{" "}
                {new Date(
                  connection?.observedAt ?? guide.observedAt,
                ).toLocaleString()}
              </p>
            </details>
          )}
        </>
      )}
      {tokenAgentId && (
        <div className="grid gap-2">
          <p>
            Agent {tokenAgentId}의 연결 토큰이 이 PC에 없습니다. 새 토큰을
            발급하면 연결을 이어서 준비해요.
          </p>
          <p className="field-hint">
            다른 PC에서 이 Agent로 연결해 두었다면 기존 토큰이 무효가 되어 그
            연결은 끊어집니다.
          </p>
          <button
            className="button button-primary"
            type="button"
            disabled={busy || !setup.issueToken}
            onClick={() => void action(() => resume(undefined, true))}
          >
            토큰 발급 후 재개
          </button>
        </div>
      )}
      {!guide && !notice && !tokenAgentId && (
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
      <div className="modal-footer">
        <button
          className="button button-secondary"
          type="button"
          disabled={busy}
          onClick={onClose}
        >
          {step === "connected" ? "닫기" : "나중에 하기"}
        </button>
      </div>
    </div>
  );
}
