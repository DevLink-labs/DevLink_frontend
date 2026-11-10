import { createContext, useContext } from 'react'

export type NoticeKind = 'success' | 'error'
export type NoticeAction = { label: string; onClick: () => void }
export type Notify = (message: string, kind?: NoticeKind, action?: NoticeAction) => void

export const NoticeContext = createContext<Notify | null>(null)

export function useNotice() {
  const notify = useContext(NoticeContext)
  if (!notify) throw new Error('NoticeProvider가 필요합니다.')
  return notify
}
