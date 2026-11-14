import { useTranslation } from "@/lib/i18n";
import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NoticeContext } from '../../hooks/useNotice'
import type { NoticeAction, NoticeKind } from '../../hooks/useNotice'
import { getDesktopApi } from '../../features/desktop-setup/api/desktopApi'
import { Icon } from '../ui'

type Notice = { id: number; message: string; kind: NoticeKind; action?: NoticeAction }

export default function NoticeProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [notice, setNotice] = useState<Notice | null>(null)
  const notify = useCallback((message: string, kind: NoticeKind = 'success', action?: NoticeAction) => {
    setNotice({ id: Date.now(), message, kind, action })
  }, [])

  useEffect(() => {
    if (!notice) return
    // 닫히기 직전에 새 알림이 오면 이전 타이머가 새 알림을 지우지 않도록 자기 알림만 닫음
    const timer = window.setTimeout(() => setNotice((current) => (current === notice ? null : current)), notice.kind === 'error' ? 8000 : 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  return <NoticeContext.Provider value={notify}>
    {children}
    {notice && <div className={`toast toast-${notice.kind}${getDesktopApi() ? ' toast-desktop' : ''}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <span className="toast-icon"><Icon name={notice.kind === 'success' ? 'check' : 'shield'} size={17} /></span>
      <span>{notice.message}</span>
      {notice.action && <button type="button" className="button button-secondary button-small" onClick={() => { notice.action?.onClick(); setNotice(null) }}>{notice.action.label}</button>}
      <button type="button" className="icon-button" aria-label={t("알림 닫기")} onClick={() => setNotice(null)}><Icon name="close" size={16} /></button>
    </div>}
  </NoticeContext.Provider>
}
