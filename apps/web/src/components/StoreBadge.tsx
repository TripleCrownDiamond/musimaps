import { Apple, Play } from 'lucide-react'
import type { LandingContent } from '../lib/cms'

interface StoreBadgeProps {
  href?: string
  icon: typeof Apple
  top: string
  bottom: string
}

/** Badge de téléchargement façon App Store / Google Play (rendu maison).
 *  Sans `href`, l'app n'est pas encore publiée : badge inerte « Bientôt ». */
export function StoreBadge({ href, icon: Icon, top, bottom }: StoreBadgeProps) {
  const content = (
    <>
      <Icon className="h-8 w-8 shrink-0 text-brand transition-colors group-hover:text-black" />
      <span className="text-left">
        <span className="block text-[11px] uppercase tracking-widest text-gray-400 transition-colors group-hover:text-black/70">
          {top}
        </span>
        <span className="block text-lg font-bold text-white transition-colors group-hover:text-black">
          {bottom}
        </span>
      </span>
    </>
  )
  const base =
    'flex w-full items-center justify-center gap-4 rounded-2xl border border-white/15 bg-white/[0.06] px-7 py-4 backdrop-blur sm:w-auto'
  if (!href) {
    return (
      <div className={`${base} opacity-60`} aria-disabled="true">
        {content}
      </div>
    )
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group ${base} transition-all hover:scale-105 hover:border-brand hover:bg-brand`}
    >
      {content}
    </a>
  )
}

/**
 * Badges à afficher pour la section stores du CMS. Chaque store a son propre
 * état : « Disponible sur » (lien) une fois l'app publiée, « Bientôt
 * disponible » (badge inerte) avant. Un store sans URL est masqué.
 */
export function storeBadges(stores: LandingContent['stores']): (StoreBadgeProps & { key: string })[] {
  const badges: (StoreBadgeProps & { key: string })[] = []
  if (stores.appStoreUrl) {
    badges.push({
      key: 'app-store',
      href: stores.appStoreLive ? stores.appStoreUrl : undefined,
      icon: Apple,
      top: stores.appStoreLive ? stores.availableLabel : stores.soonLabel,
      bottom: stores.appStoreLabel,
    })
  }
  if (stores.playStoreUrl) {
    badges.push({
      key: 'play-store',
      href: stores.playStoreLive ? stores.playStoreUrl : undefined,
      icon: Play,
      top: stores.playStoreLive ? stores.availableLabel : stores.soonLabel,
      bottom: stores.playStoreLabel,
    })
  }
  return badges
}
