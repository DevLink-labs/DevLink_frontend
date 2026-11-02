import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import PageTitle from './components/PageTitle.tsx'
import TeamDesignPreview from './components/team-preview/TeamDesignPreview.tsx'

const ImmersiveTeamPreview = lazy(() => import('./components/team-preview/ImmersiveTeamPreview.tsx'))
const TeamObservatory = lazy(() => import('./components/team-preview/TeamObservatory.tsx'))
const TeamNetworkPreview = lazy(() => import('./components/team-preview/TeamNetworkPreview.tsx'))
const Agentation = import.meta.env.DEV
  ? lazy(() => import('agentation').then((module) => ({ default: module.Agentation })))
  : null
const isNetworkPreview = window.location.pathname.replace(/\/$/, '') === '/team-network'
  || new URLSearchParams(window.location.search).get('preview') === 'agents-3'
const isObservatoryPreview = window.location.pathname.replace(/\/$/, '') === '/team-observatory'
  || new URLSearchParams(window.location.search).get('preview') === 'agents-2'
const isImmersivePreview = window.location.pathname.replace(/\/$/, '') === '/team-orbit'
  || new URLSearchParams(window.location.search).get('preview') === 'orbit'
  || new URLSearchParams(window.location.search).get('preview') === 'agents'
const isTeamPreview = window.location.pathname.replace(/\/$/, '') === '/team-preview'
  || new URLSearchParams(window.location.search).get('preview') === 'team'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {Agentation && <Suspense fallback={null}><Agentation /></Suspense>}
    {isNetworkPreview ? <Suspense fallback={<div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', background: '#f3f4f6', color: '#22262c' }} role="status" aria-label="3D 팀 스페이스 - 3를 준비하는 중"><PageTitle title="3D 팀 스페이스 - 3" />DevLink</div>}><TeamNetworkPreview /></Suspense> : isObservatoryPreview ? <Suspense fallback={<div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', background: '#f5f5f7', color: '#1d1d1f' }} role="status" aria-label="3D 팀 스페이스 - 2를 준비하는 중"><PageTitle title="3D 팀 스페이스 - 2" />DevLink</div>}><TeamObservatory /></Suspense> : isImmersivePreview ? <Suspense fallback={<div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', background: '#f4f5f7', color: '#2a2f39' }} role="status" aria-label="3D 팀 스페이스를 준비하는 중"><PageTitle title="3D 팀 스페이스" />DevLink</div>}><ImmersiveTeamPreview /></Suspense> : isTeamPreview ? <TeamDesignPreview /> : <App />}
  </StrictMode>,
)
