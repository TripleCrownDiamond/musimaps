import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut, Menu, UserRound, X } from 'lucide-react'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'
import LangToggle from './LangToggle'
import { useCms } from '../context/CmsContext'
import { useThemeValue } from '../lib/theme'
import { resolveBrandLogo } from '@musimaps/shared'
import logoBlack from '../assets/brand/logo-black.png'
import logoWhite from '../assets/brand/logo-white.png'
import iconBlue from '../assets/brand/icon.png'
import iconWhite from '../assets/brand/icon-white.png'
import { useAuth } from '../context/AuthContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import { AnimatedAvatar } from './AnimatedAvatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

/** Hauteur par défaut du logo navbar si le CMS n'en définit pas. */
const DEFAULT_NAVBAR_LOGO_HEIGHT = 40

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const { content } = useCms()
  const theme = useThemeValue()
  const { user, loading, signOut } = useAuth()
  const { t } = useLanguage()
  const localize = useLocalizedPath()
  // Chemin sans préfixe de locale : la waitlist est une ancre sur l'accueil.
  const strippedPath = pathname.replace(/^\/(en)(?=\/|$)/, '') || '/'

  // Logo CMS (priorité) — sauf anciens logos cyan, ignorés pour retomber sur
  // le logo officiel embarqué (noir en clair, blanc en sombre).
  const navbarLogo =
    resolveBrandLogo(
      content.brand.navbarLogoLight,
      content.brand.navbarLogoDark,
      theme,
    ) ?? (theme === 'dark' ? logoWhite : logoBlack)
  const navbarLogoHeight = content.brand.navbarLogoHeight || DEFAULT_NAVBAR_LOGO_HEIGHT
  const links = content.nav.links

  // Sur l'accueil la waitlist est une ancre ; ailleurs il faut y revenir par la route.
  const waitlistTo = strippedPath === '/' ? '#waitlist' : localize('/#waitlist')

  const handleSignOut = async () => {
    setOpen(false)
    await signOut()
  }

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex justify-center px-6 py-6 md:px-12">
      <nav className="w-full max-w-7xl rounded-[2rem] border border-hairline bg-surface/70 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <Link
            to={localize('/')}
            onClick={() => setOpen(false)}
            aria-label={t('common.homeAria')}
            className="shrink-0"
          >
            {/* Desktop : logo horizontal (icône + texte). Mobile : icône seule,
                blanche en sombre / bleue en clair — comme l'app mobile. */}
            <img
              src={navbarLogo}
              alt="Musimaps"
              className="hidden w-auto shrink-0 md:block"
              style={{ height: navbarLogoHeight, maxHeight: 140 }}
            />
            <img
              src={theme === 'dark' ? iconWhite : iconBlue}
              alt="Musimaps"
              className="block w-auto shrink-0 md:hidden"
              style={{ height: Math.round(navbarLogoHeight * 1.05), maxHeight: 44 }}
            />
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                to={localize(link.to)}
                aria-current={strippedPath === link.to ? 'page' : undefined}
                className={`text-sm font-medium whitespace-nowrap transition-colors hover:text-brand-deep ${
                  strippedPath === link.to ? 'text-brand-deep' : ''
                }`}
              >
                {link.label}
              </Link>
            ))}

            {/* CTA waitlist : réservé aux visiteurs non connectés */}
            {!user && (
              <a
                href={waitlistTo}
                aria-current={hash === '#waitlist' ? 'true' : undefined}
                className="rounded-full bg-brand-deep px-6 py-2.5 text-sm font-medium whitespace-nowrap text-brand-deep-foreground transition-transform hover:scale-105"
              >
                {content.nav.ctaLabel}
              </a>
            )}

            {loading ? (
              <div
                aria-hidden="true"
                className="h-9 w-9 rounded-full border border-hairline-strong"
              />
            ) : user ? (
              <NotificationBell />
            ) : null}
            {loading ? null : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Menu du compte"
                    className="flex items-center gap-1.5 rounded-full border border-hairline-strong p-1 pr-2 transition-colors hover:bg-secondary-bg"
                  >
                    <AnimatedAvatar
                      name={user.displayName || user.email || 'M'}
                      image={user.avatarUrl}
                      alt={user.displayName ?? user.email}
                      className="size-9 rounded-full"
                      initialsClassName="bg-brand text-sm font-bold text-black"
                    />
                    <ChevronDown className="size-4 text-secondary-text" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground text-xs font-normal">
                      {t('nav.loggedInAs')}
                    </span>
                    <span className="font-medium break-all">
                      {user.displayName || user.email}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => navigate(localize('/dashboard'))}>
                    <UserRound /> {t('nav.account')}
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onSelect={() => void handleSignOut()}>
                    <LogOut /> {t('auth.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link
                to={localize('/login')}
                className="rounded-full border border-hairline-strong px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-secondary-bg"
              >
                {t('auth.loginShort')}
              </Link>
            )}

          </div>

          {/* Mobile : cloche de notifications avant le hamburger, pas dans le menu */}
          <div className="flex items-center gap-1.5 md:hidden">
            {loading ? null : user ? <NotificationBell /> : null}
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
              className="flex items-center justify-center p-1"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {open && (
          <div className="flex flex-col gap-1 border-t border-hairline pb-2 pt-4 md:hidden">
            {links.map((link) => (
              <Link
                key={link.to}
                to={localize(link.to)}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 font-medium transition-colors hover:bg-secondary-bg"
              >
                {link.label}
              </Link>
            ))}
            {/* CTA waitlist : réservé aux visiteurs non connectés */}
            {!user && (
              <a
                href={waitlistTo}
                onClick={() => setOpen(false)}
                className="mt-2 rounded-full bg-brand-deep px-6 py-3.5 text-center font-medium text-brand-deep-foreground"
              >
                {content.nav.ctaLabel}
              </a>
            )}

            {loading ? null : user ? (
              <>
                <Link
                  to={localize('/dashboard')}
                  onClick={() => setOpen(false)}
                  className="mt-2 flex items-center gap-2 rounded-full border border-hairline-strong px-6 py-3.5 text-center font-medium"
                >
                  <UserRound className="size-4" /> {t('nav.account')}
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="flex items-center justify-center gap-2 rounded-full border border-hairline-strong px-6 py-3.5 text-center font-medium text-red-600"
                >
                  <LogOut className="size-4" /> {t('auth.logout')}
                </button>
              </>
            ) : (
              <Link
                to={localize('/login')}
                onClick={() => setOpen(false)}
                className="mt-2 rounded-full border border-hairline-strong px-6 py-3.5 text-center font-medium"
              >
                {t('auth.loginShort')}
              </Link>
            )}

            {/* Langue + thème : accessibles dans le menu ouvert sur mobile */}
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline pt-4">
              <LangToggle />
              <ThemeToggle />
            </div>
          </div>
        )}
      </nav>
    </header>
  )
}
