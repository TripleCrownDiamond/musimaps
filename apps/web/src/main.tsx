import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App'
import { CmsProvider } from './context/CmsContext'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './i18n/LanguageContext'
import { Toaster } from './components/ui/sonner'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <CmsProvider>
          <AuthProvider>
            <App />
            <Toaster />
          </AuthProvider>
        </CmsProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
