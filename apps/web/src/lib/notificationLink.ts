import { notificationDestination, type AppNotification } from '@musimaps/shared'

/** Paramètre du globe : découverte guidée autour de la position. */
export const DISCOVER_NEARBY_PARAM = 'discover'
export const DISCOVER_NEARBY_VALUE = 'nearby'
/** Paramètres du tableau de bord : fiche d'un badge, ou tous les badges. */
export const BADGE_PARAM = 'badge'
export const REWARDS_PARAM = 'rewards'

/**
 * Lien d'une notification. La destination vient de `shared` (même règle que le
 * mobile) ; la page de notifications et la cloche construisaient chacune leur
 * lien, vers l'artiste ou, à défaut, le globe.
 */
export function notificationHref(
  item: Pick<AppNotification, 'type' | 'artist_id' | 'ref'>,
  localize: (path: string) => string,
): string {
  const destination = notificationDestination(item)
  switch (destination.kind) {
    case 'artist':
      return localize(`/artist/${destination.artistId}`)
    case 'nearby':
      return `${localize('/globe')}?${DISCOVER_NEARBY_PARAM}=${DISCOVER_NEARBY_VALUE}`
    case 'achievement':
      return `${localize('/dashboard')}?${BADGE_PARAM}=${encodeURIComponent(destination.badgeId)}`
    case 'achievements':
      return `${localize('/dashboard')}?${REWARDS_PARAM}=1`
    case 'globe':
      return localize('/globe')
  }
}
