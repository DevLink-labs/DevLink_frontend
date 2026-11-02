import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import TeamDesignPreview from './components/team-preview/TeamDesignPreview.tsx'

const ImmersiveTeamPreview = lazy(() => import('./components/team-preview/ImmersiveTeamPreview.tsx'))
const isImmersivePreview = window.location.pathname.replace(/\/$/, '') === '/team-orbit'
  || new URLSearchParams(window.location.search).get('preview') === 'orbit'
  || new URLSearchParams(window.location.search).get('preview') === 'agents'
const isTeamPreview = window.location.pathname.replace(/\/$/, '') === '/team-preview'
  || new URLSearchParams(window.location.search).get('preview') === 'team'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isImmersivePreview ? <Suspense fallback={<div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', background: '#f4f5f7', color: '#2a2f39' }} role="status" aria-label="3D 팀 공간을 준비하는 중">DevLink</div>}><ImmersiveTeamPreview /></Suspense> : isTeamPreview ? <TeamDesignPreview /> : <App />}
  </StrictMode>,
)
