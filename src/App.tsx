import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Loader from './components/Loader'

const Landing = lazy(() => import('./pages/Landing'))
const GlobeExplore = lazy(() => import('./pages/GlobeExplore'))
const ArtistProfile = lazy(() => import('./pages/ArtistProfile'))
const ArtistSignup = lazy(() => import('./pages/ArtistSignup'))
const Confirmation = lazy(() => import('./pages/Confirmation'))

export default function App() {
  const { pathname } = useLocation()
  // Le globe occupe tout l'ecran et porte sa propre barre de recherche.
  const showNavbar = pathname !== '/globe'

  return (
    <>
      {showNavbar && <Navbar />}
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/globe" element={<GlobeExplore />} />
          <Route path="/artist/:id" element={<ArtistProfile />} />
          <Route path="/artistes" element={<ArtistSignup />} />
          <Route path="/merci" element={<Confirmation />} />

          {/* Anciennes URLs conservees pour ne pas casser de lien existant */}
          <Route path="/map" element={<Navigate to="/globe" replace />} />
          <Route path="/location" element={<Navigate to="/artistes" replace />} />
          <Route path="/artist" element={<Navigate to="/globe" replace />} />
          <Route path="/confirmation" element={<Navigate to="/" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  )
}
