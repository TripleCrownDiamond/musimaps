import { Suspense, lazy, useEffect } from 'react'
import type { ReactElement } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Loader from './components/Loader'
import SeoApplier from './components/SeoApplier'
import { useLanguage } from './i18n/LanguageContext'
import type { Lang } from './i18n/translations'

const Landing = lazy(() => import('./pages/Landing'))
const GlobeExplore = lazy(() => import('./pages/GlobeExplore'))
const ArtistProfile = lazy(() => import('./pages/ArtistProfile'))
const ArtistSignup = lazy(() => import('./pages/ArtistSignup'))
const Confirmation = lazy(() => import('./pages/Confirmation'))
const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const ProfileEdit = lazy(() => import('./pages/ProfileEdit'))
const Admin = lazy(() => import('./admin/AdminApp'))
const PreviewPage = lazy(() => import('./pages/PreviewPage'))

/**
 * Synchronise la langue active du contexte avec le préfixe d'URL porté par la
 * route (`/en/...` → anglais). Le français vit sans préfixe sur `/`.
 */
function LangRoute({ lang }: { lang: Lang }) {
  const { setLang } = useLanguage()
  useEffect(() => {
    setLang(lang)
  }, [lang, setLang])
  return <Outlet />
}

/**
 * Routes publiques : identiques en français (sans préfixe) et en anglais
 * (préfixe `/en`). Chaque entrée est montée dans les deux arbres de routes.
 */
const PUBLIC_ROUTES: { path: string; element: ReactElement }[] = [
  { path: '/', element: <Landing /> },
  { path: '/globe', element: <GlobeExplore /> },
  { path: '/artist/:id', element: <ArtistProfile /> },
  { path: '/artistes', element: <ArtistSignup /> },
  { path: '/profil', element: <ProfileEdit /> },
  { path: '/merci', element: <Confirmation /> },
  { path: '/login', element: <Login /> },
  { path: '/signup', element: <Signup /> },
  { path: '/forgot-password', element: <ForgotPassword /> },
  { path: '/reset-password', element: <ResetPassword /> },
  { path: '/dashboard', element: <Dashboard /> },
]

/** Chemin anglais d'une route : `/` → `/en`, `/globe` → `/en/globe`. */
function enPath(path: string): string {
  return path === '/' ? '/en' : `/en${path}`
}

export default function App() {
  const { pathname } = useLocation()
  // Le globe occupe tout l'ecran et porte sa propre barre de recherche.
  // Le dashboard admin possede son propre layout (pas de navbar publique).
  // L'apercu brouillon rend ses propres pages avec bandeau.
  const stripped = pathname.replace(/^\/(en)(?=\/|$)/, '') || '/'
  const isPreview = pathname.startsWith('/preview')
  const showNavbar = stripped !== '/globe' && !pathname.startsWith('/admin') && !isPreview

  return (
    <>
      <SeoApplier />
      {showNavbar && <Navbar />}
      <Suspense fallback={<Loader />}>
        <Routes>
          {/* Français : locale par défaut, routes sans préfixe */}
          <Route element={<LangRoute lang="fr" />}>
            {PUBLIC_ROUTES.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
          </Route>
          {/* Anglais : toutes les routes préfixées /en */}
          <Route element={<LangRoute lang="en" />}>
            {PUBLIC_ROUTES.map((r) => (
              <Route key={`en${r.path}`} path={enPath(r.path)} element={r.element} />
            ))}
          </Route>

          {/* Admin & apercu brouillon : non localises */}
          <Route path="/admin/*" element={<Admin />} />
          <Route path="/preview" element={<PreviewPage page="landing" />} />
          <Route path="/preview/artistes" element={<PreviewPage page="artistes" />} />

          {/* Anciennes URLs conservees pour ne pas casser de lien existant */}
          <Route path="/map" element={<Navigate to="/globe" replace />} />
          <Route path="/en/map" element={<Navigate to="/en/globe" replace />} />
          <Route path="/location" element={<Navigate to="/artistes" replace />} />
          <Route path="/en/location" element={<Navigate to="/en/artistes" replace />} />
          <Route path="/artist" element={<Navigate to="/globe" replace />} />
          <Route path="/en/artist" element={<Navigate to="/en/globe" replace />} />
          <Route path="/confirmation" element={<Navigate to="/" replace />} />
          <Route path="/en/confirmation" element={<Navigate to="/en" replace />} />

          {/* Toute route /en inconnue retombe sur l'accueil anglais */}
          <Route path="/en/*" element={<Navigate to="/en" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
