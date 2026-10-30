import { Link } from 'react-router-dom'
import { StoreBadge, storeBadges } from '../components/StoreBadge'
import { useCms } from '../context/CmsContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import logoWhite from '../assets/brand/logo-white.png'
import mockup from '../assets/download-mockup.webp'

/**
 * Page de téléchargement (/download) : l'app en main et les badges des
 * stores, rien d'autre. Pensée pour les QR codes, bios et liens partagés.
 * Les badges suivent le CMS (section stores de la landing) : un store en
 * ligne devient cliquable.
 */
export default function Download() {
  const { content } = useCms()
  const { t } = useLanguage()
  const localize = useLocalizedPath()

  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-6 py-12">
      <div className="flex w-full max-w-5xl flex-col items-center gap-10 md:flex-row md:justify-center md:gap-16">
        <img
          src={mockup}
          alt={t('download.mockupAlt')}
          width={900}
          height={1125}
          className="h-auto w-full max-w-[18rem] [mask-image:linear-gradient(to_bottom,black_75%,transparent)] md:max-w-sm"
        />
        <div className="flex w-full max-w-sm flex-col items-center gap-8 md:items-start">
          <Link to={localize('/')} aria-label="Musimaps">
            <img src={logoWhite} alt="Musimaps" className="h-12 w-auto" />
          </Link>
          <div className="flex w-full flex-col items-stretch gap-4">
            {storeBadges(content.landing.stores).map(({ key, ...badge }) => (
              <StoreBadge key={key} {...badge} />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
