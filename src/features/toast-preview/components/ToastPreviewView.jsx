import { useRef, useState } from "react";
import BrandLogo from "@/components/common/BrandLogo";
import NoticeStack from "@/components/common/NoticeStack";
import { Icon } from "@/components/ui";
import { toastGroups, toastScenarios } from "../lib/toastScenarios";
import "../styles/toast-preview.css";

export default function ToastPreviewView() {
  const [notices, setNotices] = useState([]);
  const latestNoticeId = useRef(0);
  const [demoChats, setDemoChats] = useState({ response: false, complete: false });
  const [inspectedNotice, setInspectedNotice] = useState(null);
  const [groupId, setGroupId] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [selectedId, setSelectedId] = useState("invite-copied");
  const [message, setMessage] = useState("초대 코드를 복사했습니다.");
  const [kind, setKind] = useState("success");
  const [actionLabel, setActionLabel] = useState("");
  const [actionResult, setActionResult] = useState("");
  const selected = toastScenarios.find((scenario) => scenario.id === selectedId);
  const visibleScenarios = toastScenarios.filter(
    (scenario) =>
      (groupId === "all" || scenario.groupId === groupId) &&
      (kindFilter === "all" || scenario.kind === kindFilter),
  );
  const errorCount = toastScenarios.filter(
    (scenario) => scenario.kind === "error",
  ).length;
  const successCount = toastScenarios.filter(
    (scenario) => scenario.kind === "success",
  ).length;
  const infoCount = toastScenarios.filter(
    (scenario) => scenario.kind === "info",
  ).length;

  function showToast(nextMessage, nextKind, nextActionLabel, options = {}) {
    setActionResult("");
    const notice = {
      id: ++latestNoticeId.current,
      title: options.title ?? selected.title,
      message: nextMessage,
      kind: nextKind,
      action: nextActionLabel.trim() ? { label: nextActionLabel.trim() } : undefined,
      inspected: false,
    };
    setNotices((current) => [...current, notice]);
  }

  function inspectNotice(notice) {
    setNotices((current) =>
      current.map((item) =>
        item.id === notice.id ? { ...item, inspected: true } : item,
      ),
    );
    setInspectedNotice(notice);
    setActionResult(
      `‘${notice.action.label}’ 버튼을 눌렀습니다. 확인한 알림에 내용을 표시했으며 토스트는 계속 유지됩니다.`,
    );
  }

  function showDemoNotice(event) {
    if (event === "response") {
      setDemoChats((current) => ({ ...current, response: true }));
      showToast(
        "‘디자인 검토 요청’에 프론트엔드 Agent의 답변이 도착했습니다. 토스트 시안과 개선 의견을 확인해보세요.",
        "info",
        "답변 확인",
        { title: "기다리던 답변이 도착했어요" },
      );
    } else if (event === "complete") {
      setDemoChats((current) => ({ ...current, complete: true }));
      showToast(
        "‘로그인 화면 개선’ 채팅이 진행 중에서 완료로 변경되었습니다. 최종 결과를 확인할 수 있습니다.",
        "success",
        "완료된 채팅 확인",
        { title: "채팅이 완료되었어요" },
      );
    } else if (event === "error") {
      showToast(
        "요청한 작업을 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.",
        "error",
        "오류 내용 확인",
        { title: "작업 처리에 문제가 생겼어요" },
      );
    } else if (event === "long") {
      showToast(
        "‘대시보드 알림 사용성 검토 및 반응형 화면 개선 요청’에 새로운 답변이 도착했습니다.\n\n변경 사항: 요청에 대한 응답을 구분하기 쉽도록 제목과 아이콘을 강조하고, 완료 상태를 별도 색상으로 표시했습니다. 작은 화면에서도 긴 문구와 여러 줄의 내용이 잘 보이는지 확인해주세요.\n\n이 알림은 다른 알림이 도착해도 사라지지 않습니다. 내용을 확인한 뒤 오른쪽 위 X 버튼으로 닫아주세요.",
        "info",
        "긴 답변 확인",
        { title: "긴 답변도 놓치지 않도록" },
      );
    } else {
      showToast(
        "팀의 Agent 정보가 업데이트되었습니다. 이 알림은 X 버튼으로 직접 닫을 수 있습니다.",
        "info",
        "",
        { title: "새로운 소식이 있어요" },
      );
    }
  }

  function selectScenario(scenario) {
    setSelectedId(scenario.id);
    setMessage(scenario.message);
    setKind(scenario.kind);
    setActionLabel(scenario.actionLabel ?? "");
    showToast(scenario.message, scenario.kind, scenario.actionLabel ?? "", {
      title: scenario.title,
    });
  }

  return (
    <main className="toast-preview">
      <header className="toast-preview-header">
        <BrandLogo className="toast-preview-logo" />
        <span className="toast-preview-preview-label">서비스 적용 디자인</span>
      </header>

      <section className="toast-preview-intro" aria-labelledby="toast-preview-title">
        <span className="toast-preview-eyebrow">NOTIFICATION / TOAST</span>
        <h1 id="toast-preview-title">놓치지 않아야 할 순간</h1>
        <p>
          답변 도착부터 채팅 완료까지, 더 또렷한 알림을 확인해보세요.
          <br />
          화면 전환에 관계없이 우측 하단에 최대 4개씩 표시되는 토스트 디자인입니다.
        </p>
        <div className="toast-preview-summary">
          <span>
            <strong>{toastScenarios.length}</strong>가지 표시 상황
          </span>
          <span>
            <strong>{successCount}</strong>개 success
          </span>
          <span>
            <strong>{infoCount}</strong>개 info
          </span>
          <span>
            <strong>{errorCount}</strong>개 error
          </span>
          <span>
            <Icon name="close" size={16} />수동 닫기
          </span>
        </div>
      </section>

      <section className="toast-preview-demo" aria-labelledby="toast-preview-demo-title">
        <div className="toast-preview-section-heading">
          <div>
            <span className="toast-preview-eyebrow">TRY IT OUT</span>
            <h2 id="toast-preview-demo-title">서비스 상황을 직접 재현해보세요</h2>
          </div>
        </div>
        <div className="toast-preview-demo-chats">
          <article className="toast-preview-demo-chat">
            <span className="toast-preview-demo-chat-icon">
              <Icon name="activity" size={21} />
            </span>
            <div>
              <h3>디자인 검토 요청</h3>
              <p role="status">
                {demoChats.response
                  ? "새 답변이 도착했습니다."
                  : "Agent의 답변을 기다리고 있습니다."}
              </p>
            </div>
            <button type="button" onClick={() => showDemoNotice("response")}>
              응답 도착시키기
            </button>
          </article>
          <article className="toast-preview-demo-chat">
            <span className="toast-preview-demo-chat-icon toast-preview-demo-chat-icon-complete">
              <Icon name="check" size={21} />
            </span>
            <div>
              <h3>로그인 화면 개선</h3>
              <p role="status">
                {demoChats.complete
                  ? "완료 · 최종 결과를 확인할 수 있습니다."
                  : "진행 중 · Agent가 작업하고 있습니다."}
              </p>
            </div>
            <button type="button" onClick={() => showDemoNotice("complete")}>
              채팅 완료로 변경
            </button>
          </article>
        </div>
        <div className="toast-preview-demo-tools" role="group" aria-label="추가 토스트 동작 확인">
          <button type="button" onClick={() => showDemoNotice("error")}>
            <Icon name="alert-circle" size={16} />오류 알림
          </button>
          <button type="button" onClick={() => showDemoNotice("long")}>
            <Icon name="book" size={16} />긴 문구 알림
          </button>
          <button type="button" onClick={() => showDemoNotice("plain")}>
            액션 버튼 없는 알림
          </button>
          <button
            type="button"
            onClick={() => ["response", "complete", "error"].forEach(showDemoNotice)}
          >
            <Icon name="plus" size={16} />알림 3개 쌓기
          </button>
        </div>
        <p className="toast-preview-demo-help">버튼을 여러 번 누르면 알림이 계속 쌓입니다. 시간이 지나거나 내용을 확인해도 사라지지 않으며, 각 X 버튼으로 개별 닫기를 확인할 수 있습니다.</p>
        <div className="toast-preview-opened" aria-live="polite" aria-atomic="true">
          <span><Icon name="eye" size={16} />확인한 알림</span>
          {inspectedNotice ? (
            <div>
              <strong>{inspectedNotice.title}</strong>
              <p>{inspectedNotice.message}</p>
            </div>
          ) : (
            <p>토스트의 ‘답변 확인’ 또는 ‘완료된 채팅 확인’을 누르면 여기에 내용을 표시합니다.</p>
          )}
        </div>
      </section>

      <div className="toast-preview-layout">
        <section className="toast-preview-catalog" aria-labelledby="toast-preview-catalog-title">
          <div className="toast-preview-section-heading">
            <h2 id="toast-preview-catalog-title">표시 상황</h2>
            <label className="toast-preview-filter">
              <span className="toast-preview-sr-only">토스트 유형 필터</span>
              <select
                value={kindFilter}
                onChange={(event) => setKindFilter(event.target.value)}
              >
                <option value="all">모든 유형</option>
                <option value="info">info</option>
                <option value="success">success</option>
                <option value="error">error</option>
              </select>
              <Icon name="chevron" size={14} />
            </label>
          </div>

          <div className="toast-preview-tabs" role="group" aria-label="표시 영역 필터">
            {[{ id: "all", label: "전체" }, ...toastGroups].map((group) => (
              <button
                key={group.id}
                type="button"
                aria-pressed={groupId === group.id}
                onClick={() => setGroupId(group.id)}
              >
                {group.label}
              </button>
            ))}
          </div>

          <p className="toast-preview-list-help">
            {visibleScenarios.length}개 상황 · 항목을 누르면 토스트가 표시됩니다.
          </p>
          <div className="toast-preview-groups">
            {toastGroups.map((group) => {
              const scenarios = visibleScenarios.filter(
                (scenario) => scenario.groupId === group.id,
              );
              if (!scenarios.length) return null;
              return (
                <section
                  className="toast-preview-group"
                  key={group.id}
                  aria-labelledby={`toast-group-${group.id}`}
                >
                  <div className="toast-preview-group-heading">
                    <h3 id={`toast-group-${group.id}`}>
                      {group.label}<span>{scenarios.length}</span>
                    </h3>
                    <p>{group.description}</p>
                  </div>
                  <div className="toast-preview-scenarios">
                    {scenarios.map((scenario) => (
                      <button
                        className="toast-preview-scenario"
                        key={scenario.id}
                        type="button"
                        aria-pressed={selectedId === scenario.id}
                        onClick={() => selectScenario(scenario)}
                      >
                        <span className={`toast-preview-scenario-icon toast-preview-scenario-icon-${scenario.kind}`}>
                          <Icon
                            name={scenario.kind === "error" ? "alert-circle" : scenario.kind === "info" ? "activity" : "check"}
                            size={18}
                          />
                        </span>
                        <span className="toast-preview-scenario-copy">
                          <span className="toast-preview-scenario-title">
                            <strong>{scenario.title}</strong>
                            {scenario.actionLabel && (
                              <span className="toast-preview-action-tag">버튼 포함</span>
                            )}
                          </span>
                          <span className="toast-preview-trigger">{scenario.trigger}</span>
                          <span className="toast-preview-message">{scenario.message}</span>
                        </span>
                        <span className="toast-preview-duration">
                          수동 닫기
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
            {!visibleScenarios.length && (
              <p className="toast-preview-empty">
                이 영역에는 선택한 유형의 토스트가 없습니다.
              </p>
            )}
          </div>
        </section>

        <aside className="toast-preview-inspector" aria-labelledby="toast-preview-inspector-title">
          <div className="toast-preview-editor">
            <div className="toast-preview-section-heading">
              <h2 id="toast-preview-inspector-title">직접 확인하기</h2>
              <span className="toast-preview-live-label">강조형 시안</span>
            </div>
            <div className="toast-preview-selection">
              <span>{selected.groupLabel}</span>
              <h3>{selected.title}</h3>
              <p>{selected.trigger}</p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                showToast(message, kind, actionLabel);
              }}
            >
              <fieldset className="toast-preview-kind">
                <legend>유형</legend>
                {[
                  { value: "info", label: "응답" },
                  { value: "success", label: "완료" },
                  { value: "error", label: "오류" },
                ].map((option) => (
                  <label key={option.value}>
                    <input
                      type="radio"
                      name="toast-kind"
                      value={option.value}
                      checked={kind === option.value}
                      onChange={() => setKind(option.value)}
                    />
                    <span>
                      {option.label}
                    </span>
                  </label>
                ))}
              </fieldset>
              <label className="toast-preview-field" htmlFor="toast-preview-message">
                메시지
                <textarea
                  id="toast-preview-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={4}
                  required
                />
              </label>
              <label className="toast-preview-field" htmlFor="toast-preview-action">
                액션 버튼 <span>선택 사항</span>
                <input
                  id="toast-preview-action"
                  value={actionLabel}
                  onChange={(event) => setActionLabel(event.target.value)}
                  placeholder="비워두면 버튼 없이 표시"
                />
              </label>
              <button
                className="toast-preview-show"
                type="submit"
                disabled={!message.trim()}
              >
                <Icon name="eye" size={18} />토스트 표시
              </button>
            </form>
            <p className="toast-preview-action-result" role="status">
              {actionResult || "액션 버튼은 이 페이지의 ‘확인한 알림’에 내용을 표시합니다. 토스트는 계속 유지됩니다."}
            </p>
          </div>

          <div className="toast-preview-notes">
            <h3>이 페이지의 토스트 동작</h3>
            <ul>
              <li>응답은 파랑, 완료는 초록, 오류는 붉은 강조색으로 구분합니다.</li>
              <li>아이콘은 응답 채우기·체크 그리기·느낌표 강조 동작을 한 번만 재생한 뒤 멈춥니다.</li>
              <li>자동으로 닫히지 않습니다. 각 토스트의 44px 크기 X 버튼으로 닫습니다.</li>
              <li>한 번에 최대 4개를 표시합니다. 넘친 알림은 ‘이전 알림’으로 확인하며 긴 내용은 스크롤할 수 있습니다.</li>
              <li>내용 확인 버튼을 눌러도 토스트는 유지하며 ‘확인함’으로 표시합니다.</li>
            </ul>
            <p>본 서비스와 같은 토스트 컴포넌트를 사용합니다. 표시 상황별 문구와 동작을 이 페이지에서 확인할 수 있습니다.</p>
            <p>사용자명·프로젝트명·작업 번호는 예시입니다. 데스크톱 작업 소식은 각각 별도 알림으로 표시됩니다.</p>
          </div>
          <p className="toast-preview-source">
            선택한 상황의 호출 위치<br /><span>{selected.sources}</span>
          </p>
        </aside>
      </div>
      <footer className="toast-preview-footer">
        DevLink · Toast preview
        <span>로그인과 API 연결 없이 동작하는 독립 미리보기</span>
      </footer>
      <NoticeStack
        notices={notices}
        onDismiss={(id) =>
          setNotices((current) => current.filter((notice) => notice.id !== id))
        }
        onInspect={inspectNotice}
      />
    </main>
  );
}
