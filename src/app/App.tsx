import { lazy, Suspense } from "react";
import PageTitle from "@/components/common/PageTitle";
import { useSession } from "@/features/auth/hooks/useSession";
import AuthPage from "@/pages/AuthPage";

const WorkspacePage = lazy(() => import("@/pages/WorkspacePage"));

export default function App() {
  const { user, booting } = useSession()
  if (booting) return <div className="boot-screen">
    <PageTitle title="로그인 확인" /><span className="brand-symbol">D<span /></span>
    <h1>DevLink</h1><p className="muted">로그인 상태를 확인하고 있어요.</p><span className="loading-bar" />
  </div>
  if (!user) return <AuthPage />;
  return (
    <Suspense fallback={<div className="boot-screen" role="status"><PageTitle title="워크스페이스" /><span className="brand-symbol">D</span><p className="muted">워크스페이스를 준비하고 있어요.</p></div>}>
      <WorkspacePage key={user.userId} user={user} />
    </Suspense>
  );
}
