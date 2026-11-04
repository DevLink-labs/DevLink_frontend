import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { NoticeContext } from '../../hooks/useNotice'
import type { NoticeKind } from '../../hooks/useNotice'
import { Icon } from '../ui'

type Notice = { id: number; message: string; kind: NoticeKind }

export default function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null)
  const notify = useCallback((message: string, kind: NoticeKind = 'success') => {
    setNotice({ id: Date.now(), message, kind })
  }, [])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), notice.kind === 'error' ? 8000 : 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  return <NoticeContext.Provider value={notify}>
    {children}
    {notice && <div className={`toast toast-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}>
      <span className="toast-icon"><Icon name={notice.kind === 'success' ? 'check' : 'shield'} size={17} /></span>
      <span>{notice.message}</span>
      <button type="button" className="icon-button" aria-label="알림 닫기" onClick={() => setNotice(null)}><Icon name="close" size={16} /></button>
    </div>}
  </NoticeContext.Provider>
}
