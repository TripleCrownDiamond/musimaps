import { Link } from 'react-router-dom'
import { StoreBadge, storeBadges } from '../components/StoreBadge'
import { useCms } from '../context/CmsContext'
import { useLocalizedPath } from '../i18n/LanguageContext'
import logoWhite from '../assets/brand/logo-white.png'

/**
 * Page de téléchargement (/download) : uniquement les badges des stores,
 * pensée pour les QR codes, bios et liens partagés. Les badges suivent le
 * CMS (section stores de la landing) : un store en ligne devient cliquable.
 */
export default function Download() {
  const { content } = useCms()
  const localize = useLocalizedPath()

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-12 bg-black px-6 py-16">
      <Link to={localize('/')} aria-label="Musimaps">
        <img src={logoWhite} alt="Musimaps" className="h-12 w-auto" />
      </Link>
      <div className="flex w-full max-w-sm flex-col items-stretch gap-4 sm:max-w-none sm:flex-row sm:justify-center">
        {storeBadges(content.landing.stores).map(({ key, ...badge }) => (
          <StoreBadge key={key} {...badge} />
        ))}
      </div>
    </main>
  )
}
