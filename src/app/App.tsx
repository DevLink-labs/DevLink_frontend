import { useTranslation } from "@/lib/i18n";
import { lazy, Suspense } from "react";
import PageTitle from "@/components/common/PageTitle";
import BrandLogo from "@/components/common/BrandLogo";
import { useSession } from "@/features/auth/hooks/useSession";
import AuthPage from "@/pages/AuthPage";

const DependencyTreePage = lazy(() => import("@/pages/DependencyTreePage.jsx"));
const WorkspaceEntryPage = lazy(() => import("@/pages/WorkspaceEntryPage"));

export default function App({ dependencyTree = false }: { dependencyTree?: boolean }) {
  const { t } = useTranslation();
  const { user, booting } = useSession()
  if (booting) return <div className="boot-screen">
    <PageTitle title={t("로그인 확인")} />
    <span aria-hidden="true"><BrandLogo variant="icon" className="boot-brand-icon" /></span>
    <h1 className="boot-brand-title"><BrandLogo variant="wordmark" className="boot-brand-wordmark" /></h1>
    <p className="muted">{t("로그인 상태를 확인하고 있어요.")}</p><span className="loading-bar" />
  </div>
  if (!user) return <AuthPage />;
  return (
    <Suspense fallback={<div className="boot-screen" role="status">
      <PageTitle title={t("워크스페이스")} />
      <span aria-hidden="true"><BrandLogo variant="icon" className="boot-brand-icon" /></span>
      <h1 className="boot-brand-title"><BrandLogo variant="wordmark" className="boot-brand-wordmark" /></h1>
      <p className="muted">{t("워크스페이스를 준비하고 있어요.")}</p>
    </div>}>
      {dependencyTree
        ? <DependencyTreePage key={user.userId} user={user} />
        : <WorkspaceEntryPage key={user.userId} user={user} />}
    </Suspense>
  );
}
