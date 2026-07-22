import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import logo from '../assets/logo/logo2.png'

const links = [
  { to: '/globe', label: 'La carte' },
  { to: '/artistes', label: 'Artistes' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { pathname, hash } = useLocation()

  // Sur l'accueil la waitlist est une ancre ; ailleurs il faut y revenir par la route.
  const waitlistTo = pathname === '/' ? '#waitlist' : '/#waitlist'

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex justify-center px-6 py-6 md:px-12">
      <nav className="w-full max-w-7xl rounded-[2rem] border border-hairline bg-surface/70 px-6 py-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <Link to="/" onClick={() => setOpen(false)} aria-label="MusiMaps — accueil">
            <img src={logo} alt="MusiMaps" className="h-8 w-auto" />
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={pathname === link.to ? 'page' : undefined}
                className={`text-sm font-medium transition-colors hover:text-brand-deep ${
                  pathname === link.to ? 'text-brand-deep' : ''
                }`}
              >
                {link.label}
              </Link>
            ))}
            <a
              href={waitlistTo}
              aria-current={hash === '#waitlist' ? 'true' : undefined}
              className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-ink-foreground transition-transform hover:scale-105"
            >
              Rejoindre la liste
            </a>
            <ThemeToggle />
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
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
                to={link.to}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-4 py-3 font-medium transition-colors hover:bg-secondary-bg"
              >
                {link.label}
              </Link>
            ))}
            <a
              href={waitlistTo}
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-ink px-6 py-3.5 text-center font-medium text-ink-foreground"
            >
              Rejoindre la liste
            </a>
          </div>
        )}
      </nav>
    </header>
  )
}
