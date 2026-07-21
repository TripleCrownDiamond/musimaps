import { Link } from 'react-router-dom'
import { useThemeValue } from '../lib/theme'
import logoLight from '../assets/logo/musimaps-06.png'
import logoDark from '../assets/logo/musimaps-04.png'

const year = new Date().getFullYear()

export default function Footer() {
  const theme = useThemeValue()

  return (
    <footer className="border-t border-hairline px-6 py-12 md:px-12">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-8 md:flex-row">
        <Link to="/" aria-label="MusiMaps — accueil">
          <img src={theme === 'dark' ? logoDark : logoLight} alt="MusiMaps" className="h-6 w-auto" />
        </Link>
        <nav className="flex flex-wrap justify-center gap-8 text-sm text-secondary-text">
          <Link to="/globe" className="transition-colors hover:text-primary-text">
            La carte
          </Link>
          <Link to="/artistes" className="transition-colors hover:text-primary-text">
            Espace artistes
          </Link>
          <a href="/#waitlist" className="transition-colors hover:text-primary-text">
            Liste d'attente
          </a>
          <a
            href="https://twitter.com/intent/tweet?text=D%C3%A9couvrez%20MusiMaps%20%E2%80%94%20la%20carte%20vivante%20de%20la%20musique"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-primary-text"
          >
            Twitter
          </a>
        </nav>
        <p className="text-sm text-secondary-text">&copy; {year} MusiMaps. La carte vivante de la musique.</p>
      </div>
    </footer>
  )
}
