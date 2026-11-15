import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { NoticeContext } from "@/hooks/useNotice";
import type { NoticeAction, NoticeKind } from "@/hooks/useNotice";
import { useTranslation } from "@/lib/i18n";
import { Icon } from "../ui";
import "./NoticeProvider.css";

type Notice = {
  id: number;
  message: string;
  kind: NoticeKind;
  action?: NoticeAction;
};

export default function NoticeProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [notice, setNotice] = useState<Notice | null>(null);
  const latestId = useRef(0);
  const notify = useCallback(
    (message: string, kind: NoticeKind = "success", action?: NoticeAction) => {
      setNotice({ id: ++latestId.current, message, kind, action });
    },
    [],
  );
  const isError = notice?.kind === "error";

  useEffect(() => {
    if (!notice) return;
    // 닫히기 직전에 새 알림이 오면 이전 타이머가 새 알림을 지우지 않도록 자기 알림만 닫음
    const timer = window.setTimeout(
      () => setNotice((current) => (current === notice ? null : current)),
      notice.kind === "error" ? 8000 : 5000,
    );
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <NoticeContext.Provider value={notify}>
      {children}
      {notice && (
        <div key={notice.id} className={`toast toast-${notice.kind}`}>
          <span className="toast-icon">
            <Icon name={isError ? "alert-circle" : "check"} size={20} />
          </span>
          <span className="toast-message" role={isError ? "alert" : "status"}>
            {notice.message}
          </span>
          {notice.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                notice.action?.onClick();
                setNotice(null);
              }}
            >
              {notice.action.label}
            </button>
          )}
          <button
            type="button"
            className="toast-close"
            aria-label={t("알림 닫기")}
            onClick={() => setNotice(null)}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      )}
    </NoticeContext.Provider>
  );
}
