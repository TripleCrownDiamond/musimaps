import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FileText,
  Search,
  Navigation,
  Palette,
  Mic2,
  ListChecks,
  Trophy,
  HelpCircle,
  Medal,
  History,
  RefreshCw,
  Settings,
  ExternalLink,
  ChevronDown,
  Globe2,
  CalendarHeart,
  ShieldCheck,
  Smartphone,
  Menu,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import ThemeToggle from '@/components/ThemeToggle'
import Brand from '@/components/Brand'
import { AnimatedAvatar } from '@/components/AnimatedAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { currentUserEmail, signOut } from '@/lib/admin'

const nav = [
  { to: '/admin', label: 'Vue d’ensemble', icon: LayoutDashboard, end: true },
  { to: '/admin/sections', label: 'Sections (landing)', icon: FileText },
  { to: '/admin/sections?tab=faq', label: 'FAQ', icon: HelpCircle },
  { to: '/admin/seo', label: 'SEO', icon: Search },
  { to: '/admin/navigation', label: 'Navigation & footer', icon: Navigation },
  { to: '/admin/brand', label: 'Logo & favicon', icon: Palette },
  { to: '/admin/artistes', label: 'Page artistes', icon: Mic2 },
  { to: '/admin/onboarding', label: 'Onboarding app', icon: Smartphone },
  { to: '/admin/waitlist', label: 'Liste d’attente', icon: ListChecks },
  { to: '/admin/badges', label: 'Catalogue badges', icon: Medal },
  { to: '/admin/gamification', label: 'Badges & trophées', icon: Trophy },
  { to: '/admin/bookings', label: 'Réservations', icon: CalendarHeart },
  { to: '/admin/discovered', label: 'Artistes découverts', icon: Globe2 },
  { to: '/admin/claims', label: 'Revendications', icon: ShieldCheck },
  { to: '/admin/history', label: 'Historique', icon: History },
  { to: '/admin/cache', label: 'Cache', icon: RefreshCw },
  { to: '/admin/settings', label: 'Réglages', icon: Settings },
]

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-brand-deep text-brand-deep-foreground font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )
          }
        >
          <Icon className="size-4 shrink-0" />
          {label}
        </NavLink>
      ))}
    </>
  )
}

export default function AdminLayout() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    void currentUserEmail().then((value) => setEmail(value ?? ''))
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/admin')
  }

  // Verrouille le scroll du fond + fermeture au clavier tant que le drawer est ouvert.
  useEffect(() => {
    if (!mobileOpen) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileOpen])

  return (
    <div className="bg-background text-foreground flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="border-border bg-card hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="flex flex-col gap-1 px-6 py-5">
          <Brand />
          <p className="text-muted-foreground text-xs">Dashboard admin</p>
        </div>
        <Separator />
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          <NavItems />
        </nav>
        <Separator />
        <div className="flex flex-col gap-2 p-3">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={() => window.open('/', '_blank')}
          >
            <ExternalLink /> Voir le site
          </Button>
        </div>
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="bg-card absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col shadow-2xl">
            <div className="flex items-center justify-between gap-2 px-5 py-4">
              <Brand />
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
              >
                <X className="size-5" />
              </button>
            </div>
            <Separator />
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              <NavItems onNavigate={() => setMobileOpen(false)} />
            </nav>
            <Separator />
            <div className="flex flex-col gap-2 p-3">
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  setMobileOpen(false)
                  window.open('/', '_blank')
                }}
              >
                <ExternalLink /> Voir le site
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Contenu */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-card/80 sticky top-0 z-30 flex items-center gap-3 border-b px-3 py-3 backdrop-blur sm:px-4 md:px-8">
          {/* Burger mobile + logo compact */}
          <button
            type="button"
            aria-label="Ouvrir le menu"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-muted md:hidden"
          >
            <Menu className="size-5" />
          </button>
          <div className="hidden md:block">
            <Brand className="text-xl" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Profil utilisateur"
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-1.5 py-1.5 transition-colors hover:bg-accent/60"
                >
                  <AnimatedAvatar
                    name={email || 'MM'}
                    className="size-8 rounded-full"
                    initialsClassName="bg-brand text-sm font-bold text-black"
                  />
                  <ChevronDown className="mr-1 size-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground">Connecté en tant que</span>
                  <span className="font-medium break-all">{email || 'Administrateur'}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => window.open('/', '_blank')}>
                  <ExternalLink /> Voir le site
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => void handleSignOut()}>
                  Se déconnecter
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <div className="mx-auto w-full max-w-4xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
