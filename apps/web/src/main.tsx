import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { configureRuntime } from '@musimaps/shared'
import './index.css'
import App from './App'
import { supabase } from './lib/supabase'
import { webStorage } from './lib/storage'
import { MAPBOX_TOKEN } from './lib/mapbox'
import { CmsProvider } from './context/CmsContext'
import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './i18n/LanguageContext'
import { Toaster } from './components/ui/sonner'

// Injecte le client Supabase, le stockage et le token Mapbox dans le socle
// partagé, AVANT tout rendu : les modules de `@musimaps/shared` les lisent à
// l'exécution. Le token vient de `lib/mapbox` — seul lecteur de
// l'environnement côté web.
configureRuntime({
  mapboxToken: MAPBOX_TOKEN,
  supabase,
  storage: webStorage,
  resetPasswordUrl: `${window.location.origin}/reset-password`,
})

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
