import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { nextIndexWithinPlace, type Artist } from '@musimaps/shared'
import { useLanguage } from '../i18n/LanguageContext'

export interface PlacePanelData {
  kind: 'country' | 'city'
  name: string
  code: string
  flag: string
  artists: Artist[]
}

interface PlacePanelProps {
  place: PlacePanelData
  /** Index de l'artiste courant dans la nav « jump ». */
  index: number
  onJump: (index: number) => void
  onSelect: (artist: Artist) => void
  onClose: () => void
}

/**
 * Mini-barre « lieu » : un petit pill translucide au-dessus des boutons bas
 * (vue globe + rotation) avec les flèches pour sauter d'artiste en artiste
 * dans le lieu — le pin se déplace sur la carte, sans quitter le globe.
 * Volontairement dépouillé : pas de stats, pas de carrousel, pas d'avatars.
 */
export default function PlacePanel({
  place,
  index,
  onJump,
  onSelect,
  onClose,
}: PlacePanelProps) {
  const { t } = useLanguage()
  const artists = place.artists
  const count = artists.length
  const current = artists[index] ?? artists[0]

  // SECONDE garde : la navigation ne peut pas sortir de la zone. Même si un
  // artiste mal géolocalisé échappait au filtre du cluster, la flèche le saute
  // au lieu d'y voler — l'utilisateur ne se retrouve jamais téléporté à
  // 3 500 km au milieu d'un parcours dans un même lieu.
  const jump = (dir: 1 | -1) => {
    if (count === 0) return
    onJump(nextIndexWithinPlace(artists, index, dir))
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-30 flex justify-center px-4 sm:bottom-24">
      {/* Verre sombre : mêmes valeurs que la mini-barre mobile, lues depuis
          `mapOverlays` via les variables générées — voir tokens.ts. */}
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-[var(--map-glass-border)] bg-[var(--map-glass-surface)] px-2 py-1.5 shadow-xl backdrop-blur-xl">
        {/* Flèche précédent — translucide comme le bouton play */}
        <button
          type="button"
          onClick={() => jump(-1)}
          aria-label={t('place.prev')}
          title={t('place.prev')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--map-glass-control)] text-white transition-colors hover:bg-white/25"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Artiste COURANT en principal, lieu et position en secondaire.
            Le panneau n'affichait que le lieu : on naviguait à l'aveugle
            entre les artistes sans savoir sur lequel on était. */}
        <button
          type="button"
          onClick={() => current && onSelect(current)}
          className="flex min-w-0 flex-col items-start gap-0.5 rounded-full px-3 py-1 text-left transition-colors hover:bg-white/5"
        >
          <span className="max-w-[42vw] truncate text-sm font-bold leading-tight text-white sm:max-w-none">
            {current?.name ?? place.name}
          </span>
          <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] font-medium text-[var(--map-glass-ink-soft)]">
            <span>{place.flag}</span>
            <span className="max-w-[30vw] truncate sm:max-w-none">{place.name}</span>
            <span aria-hidden>·</span>
            <span>{t('place.position', { index: index + 1, count })}</span>
          </span>
        </button>

        {/* Flèche suivant — translucide comme le bouton play */}
        <button
          type="button"
          onClick={() => jump(1)}
          aria-label={t('place.next')}
          title={t('place.next')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--map-glass-control)] text-white transition-colors hover:bg-white/25"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Fermer : discret, à droite */}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('place.close')}
          title={t('place.close')}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
