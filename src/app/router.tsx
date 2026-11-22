import { useTranslation } from "@/lib/i18n";
import { lazy, Suspense } from 'react'
import PageTitle from '../components/common/PageTitle'
import BrandLogo from "@/components/common/BrandLogo";
import Providers from './providers'
import App from './App'

const TeamDesignPreview = lazy(() => import('../features/team-preview/components/TeamDesignPreview'))
const ImmersiveTeamPreview = lazy(() => import('../features/team-preview/components/ImmersiveTeamPreview'))
const TeamObservatory = lazy(() => import('../features/team-preview/components/TeamObservatory'))
const TeamNetworkPreview = lazy(() => import('../features/team-preview/components/TeamNetworkPreview'))
const DashboardDesignPage = lazy(() => import("@/pages/DashboardDesignPage.jsx"));
const ServiceDemoPage = lazy(() => import("@/pages/ServiceDemoPage.jsx"));
const ToastPreviewPage = lazy(() => import("@/pages/ToastPreviewPage.jsx"));

const previewRoutes = [
  {
    path: "/toast-preview",
    aliases: [],
    title: "토스트 미리보기",
    component: ToastPreviewPage,
  },
  { path: "/demo", aliases: [], title: "DevLink 시연", component: ServiceDemoPage },
  { path: '/team-network', aliases: ['agents-3'], title: '3D 팀 스페이스 - 3', component: TeamNetworkPreview },
  { path: '/team-observatory', aliases: ['agents-2'], title: '3D 팀 스페이스 - 2', component: TeamObservatory },
  { path: '/team-orbit', aliases: ['orbit', 'agents'], title: '3D 팀 스페이스', component: ImmersiveTeamPreview },
  { path: '/team-preview', aliases: ['team'], title: '팀 디자인 미리보기', component: TeamDesignPreview },
  { path: "/dashboard-design", aliases: ["dashboard"], title: "대시보드 디자인 시안", component: DashboardDesignPage },
]

export default function AppRouter() {
  const { t } = useTranslation();
  const path = window.location.pathname.replace(/\/$/, '')
  if (path === "/tree") {
    return <Providers><App openTree /></Providers>;
  }
  const preview = new URLSearchParams(window.location.search).get('preview')
  const route = previewRoutes.find((route) => route.path === path || route.aliases.includes(preview ?? ''))
  if (!route) return <Providers><App /></Providers>
  const Preview = route.component
  return <Suspense fallback={<div className="grid min-h-svh place-items-center bg-workspace text-ink" role="status" aria-label={t("{{title}}를 준비하는 중", { title: t(route.title) })}><PageTitle title={t(route.title)} /><BrandLogo /></div>}>
    <Preview />
  </Suspense>
}
