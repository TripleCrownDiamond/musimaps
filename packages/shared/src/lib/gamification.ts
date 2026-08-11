/**
 * Gamification — système UNIQUE, partagé web + mobile, piloté par l'admin.
 *
 * Il existait auparavant deux systèmes sans aucun symbole en commun :
 *
 *   - le web  : badges par rôle, définis EN DUR dans le code, métriques
 *     riches (streak, suivis, réservations, vues, dates), avec progression ;
 *   - le mobile : badges en RÈGLES DE DONNÉES éditables depuis le CMS,
 *     niveaux nommés, date d'obtention — mais seulement trois métriques
 *     (villes, favoris, profil) et aucune notion de rôle.
 *
 * On garde le meilleur des deux : l'architecture en données du mobile
 * (tout est éditable en admin), les métriques et le ciblage par rôle du web,
 * la progression du web, les niveaux nommés du mobile.
 *
 * ⚠️ Aucune dépendance d'icônes ici. `icon` est une clé SÉMANTIQUE que chaque
 * plateforme mappe vers sa bibliothèque (lucide côté web, Ionicons côté
 * mobile). L'ancien module mobile importait `Ionicons` directement dans la
 * logique métier — c'est précisément ce qu'on ne veut plus.
 */
import { getSupabase } from '../runtime';

/** Rôle ciblé par un badge. `all` = tout le monde. */
export type BadgeRole = 'audience' | 'artist' | 'all';

/**
 * Métriques disponibles pour construire une règle. Réunion des deux systèmes :
 * les trois premières venaient du mobile, les suivantes du web.
 */
export type BadgeMetric =
  // Exploration (anciennement mobile)
  | 'cities'
  | 'favorites'
  | 'profile'
  // Engagement mélomane (anciennement web)
  | 'following'
  | 'streak'
  | 'bookingsSent'
  // Artiste (anciennement web)
  | 'claimed'
  | 'profileViews'
  | 'bookingsReceived'
  | 'events';

export const BADGE_METRICS: BadgeMetric[] = [
  'cities',
  'favorites',
  'profile',
  'following',
  'streak',
  'bookingsSent',
  'claimed',
  'profileViews',
  'bookingsReceived',
  'events',
];

/**
 * Vocabulaire d'icônes neutre. Chaque plateforme fournit sa table de
 * correspondance — voir `BADGE_LUCIDE` (web) et `BADGE_IONICON` (mobile).
 */
export type BadgeIconKey =
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
  | 'navigate'
  | 'earth'
  | 'planet'
  | 'music'
  | 'sparkles'
  | 'person';

export const BADGE_ICON_KEYS: BadgeIconKey[] = [
  'heart',
  'folder-heart',
  'compass',
  'star',
  'flame',
  'target',
  'crown',
  'mic',
  'badge-check',
  'eye',
  'trending-up',
  'inbox',
  'calendar-check',
  'guitar',
  'navigate',
  'earth',
  'planet',
  'music',
  'sparkles',
  'person',
];

/** Condition d'un badge, exprimée en données (éditable depuis l'admin). */
export interface BadgeRule {
  metric: BadgeMetric;
  min: number;
}

export interface BadgeDef {
  id: string;
  icon: BadgeIconKey;
  label: string;
  description: string;
  points: number;
  /** Qui peut obtenir ce badge. Absent dans l'ancien modèle mobile → 'all'. */
  role: BadgeRole;
  condition: BadgeRule;
}

/**
 * État de l'utilisateur, toutes métriques confondues. Les champs absents
 * valent 0 : une plateforme qui ne mesure pas encore une métrique ne fait
 * simplement jamais gagner les badges correspondants.
 */
export interface BadgeState {
  role: 'audience' | 'artist';
  cities?: number;
  favorites?: number;
  hasProfile?: boolean;
  following?: number;
  streak?: number;
  bookingsSent?: number;
  claimed?: boolean;
  profileViews?: number;
  bookingsReceived?: number;
  events?: number;
}

/** Badge évalué : statut, progression et points. */
export interface ComputedBadge {
  id: string;
  icon: BadgeIconKey;
  label: string;
  description: string;
  points: number;
  role: BadgeRole;
  earned: boolean;
  /** 0 → 1 (déjà 1 si obtenu). */
  progress: number;
  current: number;
  target: number;
}

/** Badge débloqué, avec la date d'obtention (timestamp ms). */
export interface EarnedBadge {
  id: string;
  earnedAt: number;
}

/** Valeur courante d'une métrique dans l'état de l'utilisateur. */
export function metricValue(metric: BadgeMetric, state: BadgeState): number {
  switch (metric) {
    case 'cities':
      return state.cities ?? 0;
    case 'favorites':
      return state.favorites ?? 0;
    case 'profile':
      return state.hasProfile ? 1 : 0;
    case 'following':
      return state.following ?? 0;
    case 'streak':
      return state.streak ?? 0;
    case 'bookingsSent':
      return state.bookingsSent ?? 0;
    case 'claimed':
      return state.claimed ? 1 : 0;
    case 'profileViews':
      return state.profileViews ?? 0;
    case 'bookingsReceived':
      return state.bookingsReceived ?? 0;
    case 'events':
      return state.events ?? 0;
  }
}

/** Évalue une règle contre l'état de l'utilisateur. */
export function satisfiesRule(rule: BadgeRule, state: BadgeState): boolean {
  return metricValue(rule.metric, state) >= Math.max(1, rule.min);
}

/** Un badge s'applique-t-il au rôle de cet utilisateur ? */
export function appliesToRole(badge: BadgeDef, role: BadgeState['role']): boolean {
  return badge.role === 'all' || badge.role === role;
}

/**
 * Évalue le catalogue pour un utilisateur : ne garde que les badges de son
 * rôle, calcule la progression de chacun.
 */
export function computeBadges(defs: BadgeDef[], state: BadgeState): ComputedBadge[] {
  return defs
    .filter((def) => appliesToRole(def, state.role))
    .map((def) => {
      const target = Math.max(1, def.condition.min);
      const raw = metricValue(def.condition.metric, state);
      const current = Math.max(0, Math.min(target, raw));
      return {
        id: def.id,
        icon: def.icon,
        label: def.label,
        description: def.description,
        points: def.points,
        role: def.role,
        earned: current >= target,
        progress: current / target,
        current,
        target,
      };
    });
}

/** Nombre de badges obtenus. */
export function earnedCount(badges: ComputedBadge[]): number {
  return badges.filter((b) => b.earned).length;
}

/** Points cumulés des badges obtenus. */
export function earnedPoints(badges: ComputedBadge[]): number {
  return badges.filter((b) => b.earned).reduce((sum, b) => sum + b.points, 0);
}

export interface LevelInfo {
  level: number;
  title: string;
  currentMin: number;
  nextMin: number | null;
  /** Progression 0 → 1 vers le niveau suivant. */
  progress: number;
}

/**
 * Paliers nommés — repris du mobile. Le web se contentait de
 * `Math.floor(points / 150) + 1`, sans titre ni progression.
 */
const LEVELS: Array<{ level: number; min: number; title: string }> = [
  { level: 1, min: 0, title: 'Explorateur' },
  { level: 2, min: 50, title: 'Voyageur' },
  { level: 3, min: 120, title: 'Globe-trotter' },
  { level: 4, min: 250, title: 'Navigateur' },
  { level: 5, min: 450, title: 'Connaisseur' },
  { level: 6, min: 700, title: 'Légende' },
];

export function getLevelInfo(points: number): LevelInfo {
  let current = LEVELS[0];
  let next: (typeof LEVELS)[number] | null = null;
  for (let i = 0; i < LEVELS.length; i += 1) {
    if (points >= LEVELS[i].min) {
      current = LEVELS[i];
      next = LEVELS[i + 1] ?? null;
    }
  }
  const span = next ? next.min - current.min : 1;
  const progress = next ? Math.min(1, Math.max(0, (points - current.min) / span)) : 1;
  return {
    level: current.level,
    title: current.title,
    currentMin: current.min,
    nextMin: next ? next.min : null,
    progress,
  };
}

/**
 * Catalogue par défaut — réunion des deux anciens catalogues. Sert de source
 * de vérité si le CMS n'a rien publié ou n'est pas joignable.
 */
export const DEFAULT_BADGES: BadgeDef[] = [
  // --- Exploration (tout le monde) ---
  { id: 'first-city', icon: 'navigate', label: 'Premier pas', description: 'Visiter sa première ville', points: 10, role: 'all', condition: { metric: 'cities', min: 1 } },
  { id: 'cities-3', icon: 'compass', label: 'Curieux', description: 'Visiter 3 villes', points: 25, role: 'all', condition: { metric: 'cities', min: 3 } },
  { id: 'cities-8', icon: 'earth', label: 'Globe-trotter', description: 'Visiter 8 villes', points: 60, role: 'all', condition: { metric: 'cities', min: 8 } },
  { id: 'cities-15', icon: 'planet', label: 'Explorateur', description: 'Visiter 15 villes', points: 120, role: 'all', condition: { metric: 'cities', min: 15 } },
  { id: 'first-save', icon: 'heart', label: 'Coup de cœur', description: 'Sauvegarder un artiste', points: 10, role: 'all', condition: { metric: 'favorites', min: 1 } },
  { id: 'saves-5', icon: 'music', label: 'Mélomane', description: 'Sauvegarder 5 artistes', points: 30, role: 'all', condition: { metric: 'favorites', min: 5 } },
  { id: 'saves-12', icon: 'sparkles', label: 'Collectionneur', description: 'Sauvegarder 12 artistes', points: 80, role: 'all', condition: { metric: 'favorites', min: 12 } },
  { id: 'profile', icon: 'person', label: 'Ambassadeur', description: 'Créer son profil', points: 20, role: 'all', condition: { metric: 'profile', min: 1 } },
  // --- Mélomane ---
  { id: 'explorer', icon: 'compass', label: 'Découvreur', description: 'Suivre 3 artistes', points: 20, role: 'audience', condition: { metric: 'following', min: 3 } },
  { id: 'superfan', icon: 'star', label: 'Superfan', description: 'Suivre 10 artistes', points: 50, role: 'audience', condition: { metric: 'following', min: 10 } },
  { id: 'streak_3', icon: 'flame', label: 'Régulier', description: '3 jours d’affilée', points: 20, role: 'audience', condition: { metric: 'streak', min: 3 } },
  { id: 'streak_7', icon: 'target', label: 'Assidu', description: '7 jours d’affilée', points: 50, role: 'audience', condition: { metric: 'streak', min: 7 } },
  { id: 'streak_30', icon: 'crown', label: 'Inarrêtable', description: '30 jours d’affilée', points: 120, role: 'audience', condition: { metric: 'streak', min: 30 } },
  { id: 'first_booking', icon: 'mic', label: 'Organisateur', description: 'Envoyer une demande de réservation', points: 40, role: 'audience', condition: { metric: 'bookingsSent', min: 1 } },
  // --- Artiste ---
  { id: 'claimed', icon: 'badge-check', label: 'Profil revendiqué', description: 'Revendiquer son profil sur la carte', points: 25, role: 'artist', condition: { metric: 'claimed', min: 1 } },
  { id: 'views_100', icon: 'eye', label: 'Repéré', description: '100 vues de profil', points: 30, role: 'artist', condition: { metric: 'profileViews', min: 100 } },
  { id: 'views_500', icon: 'trending-up', label: 'En vue', description: '500 vues de profil', points: 60, role: 'artist', condition: { metric: 'profileViews', min: 500 } },
  { id: 'first_booking_received', icon: 'inbox', label: 'Première demande', description: 'Recevoir une demande de réservation', points: 40, role: 'artist', condition: { metric: 'bookingsReceived', min: 1 } },
  { id: 'booked_3', icon: 'calendar-check', label: 'Demandé', description: 'Recevoir 3 demandes de réservation', points: 80, role: 'artist', condition: { metric: 'bookingsReceived', min: 3 } },
  { id: 'on_tour', icon: 'guitar', label: 'En tournée', description: 'Annoncer une date de concert', points: 60, role: 'artist', condition: { metric: 'events', min: 1 } },
];

/**
 * Valide le catalogue publié par le CMS et le convertit en `BadgeDef[]` sûr.
 * Retourne null si rien d'exploitable (l'appelant retombe sur DEFAULT_BADGES).
 *
 * Tolérant à l'ancien format mobile : un badge sans `role` est traité comme
 * `'all'`, et une icône hors vocabulaire retombe sur `star` plutôt que de
 * faire disparaître le badge.
 */
export function parseBadges(raw: unknown): BadgeDef[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const valid: BadgeDef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const label = typeof record.label === 'string' ? record.label.trim() : '';
    if (!id || !label || seen.has(id)) continue;

    const conditionRaw = record.condition as Record<string, unknown> | undefined;
    const metric = conditionRaw?.metric;
    if (!BADGE_METRICS.includes(metric as BadgeMetric)) continue;

    const min =
      typeof conditionRaw?.min === 'number' && Number.isFinite(conditionRaw.min)
        ? Math.max(1, Math.round(conditionRaw.min))
        : 1;
    const points =
      typeof record.points === 'number' && Number.isFinite(record.points)
        ? Math.max(0, Math.round(record.points))
        : 0;
    const iconRaw = typeof record.icon === 'string' ? record.icon : '';
    const icon = BADGE_ICON_KEYS.includes(iconRaw as BadgeIconKey)
      ? (iconRaw as BadgeIconKey)
      : 'star';
    const roleRaw = record.role;
    const role: BadgeRole =
      roleRaw === 'audience' || roleRaw === 'artist' ? roleRaw : 'all';

    seen.add(id);
    valid.push({
      id,
      icon,
      label,
      description: typeof record.description === 'string' ? record.description : '',
      points,
      role,
      condition: { metric: metric as BadgeMetric, min },
    });
  }
  return valid.length > 0 ? valid : null;
}

/**
 * Synchronise la gamification vers la table `gamification` (classement de
 * l'admin). Fire-and-forget : l'échec est silencieux.
 *
 * `userKey` : l'identifiant du compte quand l'utilisateur est connecté,
 * l'identifiant d'appareil sinon. C'est la clé de conflit de l'upsert.
 *
 * Deux défauts de l'ancienne version web sont corrigés ici :
 *  - elle écrivait `visited_cities: 0, favorites: 0` en dur, écrasant les
 *    compteurs réels de sa propre ligne ;
 *  - elle écrivait `badges` sous forme de `string[]` alors que l'admin lit
 *    des objets `{ id, earnedAt }` — ses lignes comptaient donc un badge
 *    d'identifiant `undefined` dans la répartition.
 */
export async function syncGamification(input: {
  userKey: string;
  displayName: string | null;
  badges: ComputedBadge[];
  cities?: number;
  favorites?: number;
  /** Dates d'obtention déjà connues (id → timestamp ms), pour ne pas les perdre. */
  earnedAt?: Record<string, number>;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase || !input.userKey) return;
  const now = Date.now();
  const earned: EarnedBadge[] = input.badges
    .filter((b) => b.earned)
    .map((b) => ({ id: b.id, earnedAt: input.earnedAt?.[b.id] ?? now }));
  const points = earnedPoints(input.badges);
  const level = getLevelInfo(points);
  try {
    await supabase.from('gamification').upsert(
      {
        user_key: input.userKey,
        display_name: input.displayName,
        points,
        level: level.level,
        level_title: level.title,
        badges: earned,
        badge_count: earned.length,
        visited_cities: input.cities ?? 0,
        favorites: input.favorites ?? 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_key' },
    );
  } catch {
    /* silencieux */
  }
}
