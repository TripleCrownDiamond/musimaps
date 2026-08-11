import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { hasSupabase, supabase } from '@/lib/supabase'
import { currentUserEmail, isAdminUser, signOut } from '@/lib/admin'
import LoginPage from './LoginPage'
import AdminLayout from './AdminLayout'
import OverviewPage from './pages/OverviewPage'
import SectionsPage from './pages/SectionsPage'
import SeoPage from './pages/SeoPage'
import NavFooterPage from './pages/NavFooterPage'
import BrandPage from './pages/BrandPage'
import ArtistSignupPage from './pages/ArtistSignupPage'
import OnboardingPage from './pages/OnboardingPage'
import WaitlistPage from './pages/WaitlistPage'
import BadgesPage from './pages/BadgesPage'
import GamificationPage from './pages/GamificationPage'
import SettingsPage from './pages/SettingsPage'
import CachePage from './pages/CachePage'
import HistoryPage from './pages/HistoryPage'
import BookingsPage from './pages/BookingsPage'
import DiscoveredPage from './pages/DiscoveredPage'
import ClaimsPage from './pages/ClaimsPage'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LogOut } from 'lucide-react'

type GateState = 'loading' | 'not-configured' | 'signed-out' | 'denied' | 'granted'

export default function AdminApp() {
  const [gate, setGate] = useState<GateState>('loading')

  useEffect(() => {
    if (!hasSupabase() || !supabase) {
      setGate('not-configured')
      return
    }

    const check = async () => {
      const email = await currentUserEmail()
      if (!email) {
        setGate('signed-out')
        return
      }
      let admin = await isAdminUser(email)
      // Bootstrap : le premier compte connecté devient administrateur.
      // La RLS n'autorise l'insert que lorsque la table `admins` est vide.
      // (La création de compte depuis l'app est désactivée : voir LoginPage.)
      if (!admin) {
        await supabase!.from('admins').insert({ email }).select().then(
          ({ data }) => {
            admin = Boolean(data && data.length > 0)
          },
          () => {
            /* table déjà peuplée : rien à faire */
          },
        )
      }
      setGate(admin ? 'granted' : 'denied')
    }

    // Réagit à la connexion / déconnexion pour relancer le check.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void check()
    })
    void check()
    return () => sub.subscription.unsubscribe()
  }, [])

  if (gate === 'loading') {
    return (
      <div className="bg-background text-foreground flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Espace administrateur</CardTitle>
            <CardDescription>Vérification de l’accès…</CardDescription>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  if (gate === 'not-configured') {
    return (
      <div className="bg-background text-foreground flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Supabase non configuré</CardTitle>
            <CardDescription>
              Ajoutez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans apps/web/.env.local, puis
              appliquez la migration supabase/migrations/00003_admin_cms.sql.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (gate === 'signed-out') {
    return <LoginPage />
  }

  if (gate === 'denied') {
    return (
      <div className="bg-background text-foreground flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Accès refusé</CardTitle>
            <CardDescription>
              Ce compte n’est pas autorisé à accéder au dashboard. Contactez le propriétaire du
              site pour obtenir l’accès.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                await signOut()
                setGate('signed-out')
              }}
            >
              <LogOut /> Se déconnecter
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="sections" element={<SectionsPage />} />
        <Route path="seo" element={<SeoPage />} />
        <Route path="navigation" element={<NavFooterPage />} />
        <Route path="brand" element={<BrandPage />} />
        <Route path="artistes" element={<ArtistSignupPage />} />
        <Route path="onboarding" element={<OnboardingPage />} />
        <Route path="waitlist" element={<WaitlistPage />} />
        <Route path="badges" element={<BadgesPage />} />
        <Route path="gamification" element={<GamificationPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="bookings" element={<BookingsPage />} />
        <Route path="discovered" element={<DiscoveredPage />} />
        <Route path="claims" element={<ClaimsPage />} />
        <Route path="cache" element={<CachePage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
