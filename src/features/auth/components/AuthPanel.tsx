import { useId, useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "../../../lib/apiClient";
import type { User } from "../types";
import AuthLayout from "../../../layouts/AuthLayout";
import { useAuthMutations } from "../hooks/useAuthMutations";
import type { ConnectionState } from "../hooks/useSession";
import { Icon } from "../../../components/ui";
import PageTitle from "../../../components/common/PageTitle";
import TeamSpaceLink from "../../../components/common/TeamSpaceLink";

export default function AuthPanel({
  onAuthenticated,
  onNotice,
  connectionState,
  onRetryConnection,
}: {
  onAuthenticated: (user: User) => void | Promise<void>;
  onNotice: (message: string) => void;
  connectionState: ConnectionState;
  onRetryConnection: () => void;
}) {
  const id = useId();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, signup } = useAuthMutations();
  const busy = login.isPending || signup.isPending;
  const [error, setError] = useState<string | null>(null);

  function changeMode(next: "login" | "signup") {
    setMode(next);
    setError(null);
    setPassword("");
    setShowPassword(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError(null);
    if (new TextEncoder().encode(password).length > 72) {
      setError("비밀번호가 너무 깁니다. UTF-8 기준 72바이트 이하로 입력해주세요.");
      return;
    }
    if (mode === "signup" && !name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    try {
      if (mode === "signup") {
        await signup.mutateAsync({
          email: email.trim(),
          password,
          name: name.trim(),
          ...(nickname.trim() ? { nickname: nickname.trim() } : {}),
        });
        changeMode("login");
        onNotice("회원가입이 완료됐습니다. 같은 이메일로 로그인해주세요.");
      } else {
        const user = await login.mutateAsync({ email: email.trim(), password });
        setPassword("");
        await onAuthenticated(user);
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    } finally {
      login.reset();
      signup.reset();
    }
  }

  return (
    <AuthLayout>
      <PageTitle title={mode === "login" ? "로그인" : "회원가입"} />
      <section className="auth-form-side">
        <div className={`connection-indicator connection-${connectionState}`} role="status">
          <span className="status-dot" />
          {connectionState === "online"
            ? "서버 연결됨"
            : connectionState === "checking"
              ? "서버 확인 중"
              : "서버 연결 확인 필요"}
        </div>
        <div className="auth-form-card">
          <span className="eyebrow">WELCOME TO DEVLINK</span>
          <h2>{mode === "login" ? "다시 만나 반가워요" : "새로운 협업을 시작하세요"}</h2>
          <p className="muted">
            {mode === "login"
              ? "로그인하고 팀의 개발 공간으로 이동하세요."
              : "기본 정보를 입력하면 계정을 만들 수 있어요."}
          </p>
          <div className="auth-tabs" role="tablist" aria-label="계정 메뉴">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => changeMode("login")}
              disabled={busy}
            >
              로그인
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "active" : ""}
              onClick={() => changeMode("signup")}
              disabled={busy}
            >
              회원가입
            </button>
          </div>
          {connectionState === "offline" && (
            <div className="connection-help">
              <p>서버에 연결하지 못했습니다. 백엔드 실행 상태와 API 주소를 확인해주세요.</p>
              <button className="text-button" type="button" onClick={onRetryConnection}>
                다시 확인 <Icon name="refresh" size={14} />
              </button>
            </div>
          )}
          <form className="grid gap-[18px]" onSubmit={submit}>
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-[13px] max-[420px]:grid-cols-1">
                <div className="field">
                  <label htmlFor={`${id}-name`}>이름</label>
                  <input
                    id={`${id}-name`}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    maxLength={100}
                    autoComplete="name"
                    placeholder="홍길동"
                    disabled={busy}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`${id}-nickname`}>
                    닉네임 <span className="optional">선택</span>
                  </label>
                  <input
                    id={`${id}-nickname`}
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    maxLength={100}
                    autoComplete="nickname"
                    placeholder="팀에서 사용할 이름"
                    disabled={busy}
                  />
                </div>
              </div>
            )}
            <div className="field">
              <label htmlFor={`${id}-email`}>이메일</label>
              <input
                id={`${id}-email`}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={255}
                autoComplete="username"
                placeholder="you@example.com"
                disabled={busy}
              />
            </div>
            <div className="field">
              <label htmlFor={`${id}-password`}>비밀번호</label>
              <div className="password-field">
                <input
                  id={`${id}-password`}
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={mode === "signup" ? 8 : undefined}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  placeholder={
                    mode === "signup" ? "8자 이상 입력해주세요" : "비밀번호를 입력해주세요"
                  }
                  disabled={busy}
                />
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  aria-pressed={showPassword}
                  disabled={busy}
                >
                  <Icon name={showPassword ? "eye-off" : "eye"} size={19} />
                </button>
              </div>
            </div>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary auth-submit" disabled={busy} type="submit">
              {busy ? "처리 중…" : mode === "login" ? "로그인" : "계정 만들기"}
              {!busy && <Icon name="arrow" size={19} />}
            </button>
          </form>
          <div className="auth-footnote">
            <Icon name="shield" size={16} />
            <span>로그인 정보는 보안 세션으로 관리합니다.</span>
          </div>
        </div>
        <div className="auth-bottom-caption">
          <span>DevLink Workspace · 팀과 Agent를 위한 시작점</span>
          <nav className="auth-preview-links" aria-label="미리보기 페이지">
            <a href="/?preview=team">
              팀 디자인 미리보기
              <Icon name="arrow" size={13} />
            </a>
            <TeamSpaceLink variant="auth" />
            <TeamSpaceLink variant="auth" edition={2} />
            <TeamSpaceLink variant="auth" edition={3} />
          </nav>
        </div>
      </section>
    </AuthLayout>
  );
}
