import { supabase, hasSupabase } from './supabase'

/**
 * Gamification des comptes connectés (web) — badges par rôle.
 * Le mélomane est récompensé pour la découverte (favoris, suivis, streak,
 * réservations) ; l'artiste pour l'engagement de son profil (revendication,
 * vues, demandes de booking, dates de concert).
 */

export type GamifyRole = 'audience' | 'artist'

/** Clé d'icône lucide — mappée côté UI (la lib reste framework-free). */
export type BadgeIcon =
  | 'heart'
  | 'folder-heart'
  | 'compass'
  | 'star'
  | 'flame'
  | 'target'
  | 'crown'
  | 'mic'
  | 'badge-check'
  | 'eye'
  | 'trending-up'
  | 'inbox'
  | 'calendar-check'
  | 'guitar'

export interface RoleBadge {
  id: string
  role: GamifyRole
  icon: BadgeIcon
  points: number
  earned: boolean
  /** 0 → 1 : progression vers le badge (déjà 1 si earned). */
  progress: number
  current: number
  target: number
}

export interface GamifyData {
  role: GamifyRole
  streak: number
  favorites: number
  following: number
  bookingsSent: number
  claimed: boolean
  profileViews: number
  bookingsReceived: number
  events: number
}

interface BadgeDef {
  id: string
  role: GamifyRole
  icon: BadgeIcon
  points: number
  target: number
  /** Extrait la valeur actuelle depuis les données. */
  value: (d: GamifyData) => number
}

const BADGE_DEFS: BadgeDef[] = [
  // --- Mélomane ---
  { id: 'first_favorite', role: 'audience', icon: 'heart', points: 15, target: 1, value: (d) => d.favorites },
  { id: 'collector', role: 'audience', icon: 'folder-heart', points: 30, target: 10, value: (d) => d.favorites },
  { id: 'explorer', role: 'audience', icon: 'compass', points: 20, target: 3, value: (d) => d.following },
  { id: 'superfan', role: 'audience', icon: 'star', points: 50, target: 10, value: (d) => d.following },
  { id: 'streak_3', role: 'audience', icon: 'flame', points: 20, target: 3, value: (d) => d.streak },
  { id: 'streak_7', role: 'audience', icon: 'target', points: 50, target: 7, value: (d) => d.streak },
  { id: 'streak_30', role: 'audience', icon: 'crown', points: 120, target: 30, value: (d) => d.streak },
  { id: 'first_booking', role: 'audience', icon: 'mic', points: 40, target: 1, value: (d) => d.bookingsSent },
  // --- Artiste ---
  { id: 'claimed', role: 'artist', icon: 'badge-check', points: 25, target: 1, value: (d) => (d.claimed ? 1 : 0) },
  { id: 'views_100', role: 'artist', icon: 'eye', points: 30, target: 100, value: (d) => d.profileViews },
  { id: 'views_500', role: 'artist', icon: 'trending-up', points: 60, target: 500, value: (d) => d.profileViews },
  { id: 'first_booking_received', role: 'artist', icon: 'inbox', points: 40, target: 1, value: (d) => d.bookingsReceived },
  { id: 'booked_3', role: 'artist', icon: 'calendar-check', points: 80, target: 3, value: (d) => d.bookingsReceived },
  { id: 'on_tour', role: 'artist', icon: 'guitar', points: 60, target: 1, value: (d) => d.events },
]

/** Badges du rôle concerné avec progression et statut. */
export function computeRoleBadges(data: GamifyData): RoleBadge[] {
  return BADGE_DEFS.filter((b) => b.role === data.role).map((b) => {
    const current = Math.max(0, Math.min(b.target, b.value(data)))
    return {
      id: b.id,
      role: b.role,
      icon: b.icon,
      points: b.points,
      earned: current >= b.target,
      progress: b.target <= 0 ? 0 : current / b.target,
      current,
      target: b.target,
    }
  })
}

/** Nombre de badges gagnés (profil de progression du compte). */
export function earnedCount(badges: RoleBadge[]): number {
  return badges.filter((b) => b.earned).length
}

/** Points totaux des badges gagnés. */
export function earnedPoints(badges: RoleBadge[]): number {
  return badges.filter((b) => b.earned).reduce((sum, b) => sum + b.points, 0)
}

/** Niveau simple (1 + 1 tous les 150 pts). */
export function levelFromPoints(points: number): number {
  return Math.floor(points / 150) + 1
}

/**
 * Synchronise la gamification du compte connecté vers la table `gamification`
 * (le dashboard admin s'en sert pour le classement et les stats).
 * Fire-and-forget : l'échec est silencieux.
 */
export async function syncUserGamification(input: {
  displayName: string | null
  role: GamifyRole
  badges: RoleBadge[]
}): Promise<void> {
  if (!hasSupabase()) return
  const { data } = await supabase!.auth.getUser()
  const userId = data.user?.id
  if (!userId) return
  const points = earnedPoints(input.badges)
  const earned = input.badges.filter((b) => b.earned).map((b) => b.id)
  try {
    await supabase!.from('gamification').upsert(
      {
        user_key: userId,
        display_name: input.displayName,
        points,
        level: levelFromPoints(points),
        badges: earned,
        badge_count: earned.length,
        visited_cities: 0,
        favorites: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_key' },
    )
  } catch {
    /* silencieux */
  }
}
