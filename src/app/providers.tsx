import type { ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../lib/queryClient'
import NoticeProvider from '../components/common/NoticeProvider'
import SessionProvider from '../features/auth/components/SessionProvider'

export default function Providers({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>
    <NoticeProvider>
      <SessionProvider>{children}</SessionProvider>
    </NoticeProvider>
  </QueryClientProvider>
}
