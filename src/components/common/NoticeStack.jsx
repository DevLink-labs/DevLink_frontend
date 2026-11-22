import { useId, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { Icon } from "../ui";
import NoticeIcon from "./NoticeIcon";
import "./NoticeProvider.css";

const defaultTitles = {
  info: "새로운 소식이 도착했어요",
  success: "요청을 완료했어요",
  error: "확인이 필요해요",
};

export default function NoticeStack({
  notices,
  onDismiss,
  onInspect,
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const [page, setPage] = useState(0);
  const pageSize = 4;
  const lastPage = Math.max(0, Math.ceil(notices.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * pageSize;
  const visibleNotices = [...notices].reverse().slice(start, start + pageSize);
  if (!notices.length) return null;

  function dismissNotice(id) {
    setPage(Math.min(currentPage, Math.max(0, Math.ceil((notices.length - 1) / pageSize) - 1)));
    onDismiss(id);
  }

  return (
    <section className="toast-stack" aria-label={t("서비스 알림")}>
      <div
        className="toast-list"
        tabIndex={0}
        aria-label={t("표시 중인 알림 목록")}
      >
        {visibleNotices.map((notice) => {
          const title = notice.title || t(defaultTitles[notice.kind]);
          const noticeTitleId = `${titleId}-${notice.id}`;
          return (
            <article
              key={notice.id}
              className={`toast toast-${notice.kind}`}
              role={notice.kind === "error" ? "alert" : "status"}
              aria-atomic="true"
              aria-labelledby={noticeTitleId}
            >
              <div className="toast-content">
                <span className="toast-icon">
                  <NoticeIcon kind={notice.kind} />
                </span>
                <div className="toast-copy">
                  <h2 id={noticeTitleId}>{title}</h2>
                  <p>{notice.message}</p>
                </div>
                <button
                  type="button"
                  className="toast-close"
                  aria-label={t("{{title}} 알림 닫기", { title })}
                  onClick={() => dismissNotice(notice.id)}
                >
                  <Icon name="close" size={24} />
                </button>
              </div>
              {notice.action && (
                <div className="toast-footer">
                  {notice.inspected && (
                    <span className="toast-read">{t("확인함")}</span>
                  )}
                  <button
                    type="button"
                    className="toast-action"
                    onClick={() => onInspect(notice)}
                  >
                    {notice.action.label}
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      {notices.length > pageSize && (
        <nav className="toast-pagination" aria-label={t("알림 목록 이동")}>
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            {t("최근 알림")}
          </button>
          <button
            type="button"
            disabled={currentPage === lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            {t("이전 알림")}
          </button>
        </nav>
      )}
    </section>
  );
}
