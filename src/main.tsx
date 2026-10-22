import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import SharedWorkspace from './SharedWorkspace.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {import.meta.env.VITE_SHARED_ORDERS === 'true' ? <SharedWorkspace /> : <App />}
  </StrictMode>,
)
