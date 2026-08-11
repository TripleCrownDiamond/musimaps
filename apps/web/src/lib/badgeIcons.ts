/**
 * Correspondance clé d'icône de badge → composant lucide.
 *
 * Le vocabulaire (`BadgeIconKey`) est défini dans `@musimaps/shared` et reste
 * neutre : c'est ici qu'on choisit le rendu web. Le mobile a sa propre table
 * vers Ionicons (`apps/mobile/src/badgeIcons.ts`).
 */
import {
  BadgeCheck,
  CalendarCheck,
  Compass,
  Crown,
  Earth,
  Eye,
  Flame,
  FolderHeart,
  Guitar,
  Heart,
  Inbox,
  Mic2,
  Music2,
  Navigation,
  Orbit,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  User,
  type LucideIcon,
} from 'lucide-react'
import type { BadgeIconKey } from '@musimaps/shared'

export const BADGE_LUCIDE: Record<BadgeIconKey, LucideIcon> = {
  heart: Heart,
  'folder-heart': FolderHeart,
  compass: Compass,
  star: Star,
  flame: Flame,
  target: Target,
  crown: Crown,
  mic: Mic2,
  'badge-check': BadgeCheck,
  eye: Eye,
  'trending-up': TrendingUp,
  inbox: Inbox,
  'calendar-check': CalendarCheck,
  guitar: Guitar,
  navigate: Navigation,
  earth: Earth,
  planet: Orbit,
  music: Music2,
  sparkles: Sparkles,
  person: User,
}

/** Icône d'un badge, avec repli sur l'étoile si la clé est inconnue. */
export function badgeIcon(key: string): LucideIcon {
  return BADGE_LUCIDE[key as BadgeIconKey] ?? Star
}
