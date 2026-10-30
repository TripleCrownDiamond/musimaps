import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { StoreBadge, storeBadges } from '../components/StoreBadge'
import { useCms } from '../context/CmsContext'
import { useLanguage, useLocalizedPath } from '../i18n/LanguageContext'
import logoWhite from '../assets/brand/logo-white.png'
import mockup from '../assets/download-mockup.webp'

/**
 * Page de téléchargement (/download) : l'app en main, ce qu'elle fait et
 * les badges des stores. Pensée pour les QR codes, bios et liens partagés.
 * Les badges suivent le CMS (section stores de la landing) : un store en
 * ligne devient cliquable.
 */
export default function Download() {
  const { content } = useCms()
  const { t } = useLanguage()
  const localize = useLocalizedPath()

  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-black px-6 pb-12 pt-20">
      <Link
        to={localize('/')}
        className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-brand hover:bg-brand hover:text-black md:left-8 md:top-8"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('download.backToSite')}
      </Link>
      <div className="flex w-full max-w-5xl flex-col items-center gap-10 md:flex-row md:justify-center md:gap-16">
        <img
          src={mockup}
          alt={t('download.mockupAlt')}
          width={900}
          height={1125}
          className="h-auto w-full max-w-[18rem] [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,black_75%,transparent),linear-gradient(to_right,transparent,black_15%)] md:max-w-sm"
        />
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center md:items-start md:text-left">
          <Link to={localize('/')} aria-label="Musimaps">
            <img src={logoWhite} alt="Musimaps" className="h-12 w-auto" />
          </Link>
          <h1 className="display-font text-balance text-3xl text-white md:text-4xl">{t('download.title')}</h1>
          <p className="text-base font-light text-gray-400">{t('download.description')}</p>
          <div className="flex w-full flex-col items-stretch gap-4 pt-2">
            {storeBadges(content.landing.stores).map(({ key, ...badge }) => (
              <StoreBadge key={key} {...badge} />
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
