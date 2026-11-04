import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import AppRouter from './app/router'
import './styles/index.css'

const Agentation = import.meta.env.DEV
  ? lazy(() => import('agentation').then((module) => ({ default: module.Agentation })))
  : null

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {Agentation && <Suspense fallback={null}><Agentation /></Suspense>}
    <AppRouter />
  </StrictMode>,
)
