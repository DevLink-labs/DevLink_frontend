import PageTitle from '../components/common/PageTitle'
import { useSession } from '../features/auth/hooks/useSession'
import AuthPage from '../pages/AuthPage'
import WorkspacePage from '../pages/WorkspacePage'

export default function App() {
  const { user, booting } = useSession()
  if (booting) return <div className="boot-screen">
    <PageTitle title="로그인 확인" /><span className="brand-symbol">D<span /></span>
    <h1>DevLink</h1><p className="muted">로그인 상태를 확인하고 있어요.</p><span className="loading-bar" />
  </div>
  return user ? <WorkspacePage key={user.userId} user={user} /> : <AuthPage />
}
