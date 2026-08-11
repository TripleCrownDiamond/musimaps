/**
 * Correspondance clé d'icône de badge → glyphe Ionicons.
 *
 * Le vocabulaire (`BadgeIconKey`) est défini dans `@musimaps/shared` et reste
 * neutre. Avant l'unification, `Ionicons` était importé directement dans la
 * logique de gamification — une dépendance de plateforme au milieu du métier.
 * Elle est désormais confinée ici.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BadgeIconKey } from '@musimaps/shared';

type IoniconName = keyof typeof Ionicons.glyphMap;

export const BADGE_IONICON: Record<BadgeIconKey, IoniconName> = {
  heart: 'heart',
  'folder-heart': 'albums',
  compass: 'compass',
  star: 'star',
  flame: 'flame',
  target: 'locate',
  crown: 'trophy',
  mic: 'mic',
  'badge-check': 'checkmark-circle',
  eye: 'eye',
  'trending-up': 'trending-up',
  inbox: 'mail',
  'calendar-check': 'calendar',
  guitar: 'musical-note',
  navigate: 'navigate',
  earth: 'earth',
  planet: 'planet',
  music: 'musical-notes',
  sparkles: 'sparkles',
  person: 'person',
};

/** Glyphe d'un badge, avec repli sur l'étoile si la clé est inconnue. */
export function badgeIcon(key: string): IoniconName {
  return BADGE_IONICON[key as BadgeIconKey] ?? 'star';
}
