import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Artist } from '@musimaps/shared'
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

  const jump = (dir: number) => {
    if (count === 0) return
    onJump((index + dir + count) % count)
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-30 flex justify-center px-4 sm:bottom-24">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2 py-1.5 shadow-xl backdrop-blur-xl">
        {/* Flèche précédent — translucide comme le bouton play */}
        <button
          type="button"
          onClick={() => jump(-1)}
          aria-label={t('place.prev')}
          title={t('place.prev')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Texte du lieu + compteur — clic = ouvre la fiche de l'artiste courant */}
        <button
          type="button"
          onClick={() => current && onSelect(current)}
          className="flex items-center gap-2 rounded-full px-3 py-1 text-left transition-colors hover:bg-white/5"
        >
          <span className="text-sm">{place.flag}</span>
          <span className="whitespace-nowrap text-sm font-semibold text-white">
            {place.name}
          </span>
          <span className="whitespace-nowrap rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/85">
            {t('place.count', { count, s: count > 1 ? 's' : '' })}
          </span>
        </button>

        {/* Flèche suivant — translucide comme le bouton play */}
        <button
          type="button"
          onClick={() => jump(1)}
          aria-label={t('place.next')}
          title={t('place.next')}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
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
