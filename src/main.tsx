import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import AppRouter from './app/router'
import './styles/index.css'
import "./lib/i18n";

const isStandalonePreview = ["/demo", "/toast-preview"].includes(
  window.location.pathname.replace(/\/$/, ""),
);
const Agentation = import.meta.env.DEV && !isStandalonePreview
  ? lazy(() => import('agentation').then((module) => ({ default: module.Agentation })))
  : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {Agentation && <Suspense fallback={null}><Agentation /></Suspense>}
    <AppRouter />
  </StrictMode>,
)
