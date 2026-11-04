import AuthPanel from '../features/auth/components/AuthPanel'
import { useSession } from '../features/auth/hooks/useSession'
import { useNotice } from '../hooks/useNotice'

export default function AuthPage() {
  const { onAuthenticated, connection, retryConnection } = useSession()
  const notify = useNotice()
  return <AuthPanel onAuthenticated={onAuthenticated} onNotice={notify} connectionState={connection} onRetryConnection={retryConnection} />
}
