import Ionicons from '@expo/vector-icons/Ionicons';

export type IconName = keyof typeof Ionicons.glyphMap;

export interface BadgeState {
  visitedCitiesCount: number;
  favoritesCount: number;
  hasProfile: boolean;
}

/** Condition d'un badge, exprimée en données (éditable depuis l'admin web). */
export interface BadgeRule {
  metric: 'cities' | 'favorites' | 'profile';
  min: number;
}

export interface BadgeDef {
  id: string;
  icon: IconName;
  label: string;
  description: string;
  points: number;
  condition: BadgeRule;
}

/** Badge débloqué par l'utilisateur, avec la date (timestamp ms) d'obtention. */
export interface EarnedBadge {
  id: string;
  earnedAt: number;
}

/**
 * Catalogue par défaut — source de vérité si le CMS (table site_content, clé
 * 'badges') n'est pas joignable ou n'a rien publié.
 */
export const DEFAULT_BADGES: BadgeDef[] = [
  {
    id: 'first-city',
    icon: 'navigate',
    label: 'Premier pas',
    description: 'Visiter sa première ville',
    points: 10,
    condition: { metric: 'cities', min: 1 },
  },
  {
    id: 'cities-3',
    icon: 'compass',
    label: 'Curieux',
    description: 'Visiter 3 villes',
    points: 25,
    condition: { metric: 'cities', min: 3 },
  },
  {
    id: 'cities-8',
    icon: 'earth',
    label: 'Globe-trotter',
    description: 'Visiter 8 villes',
    points: 60,
    condition: { metric: 'cities', min: 8 },
  },
  {
    id: 'cities-15',
    icon: 'planet',
    label: 'Explorateur',
    description: 'Visiter 15 villes',
    points: 120,
    condition: { metric: 'cities', min: 15 },
  },
  {
    id: 'first-save',
    icon: 'heart',
    label: 'Coup de cœur',
    description: 'Sauvegarder un artiste',
    points: 10,
    condition: { metric: 'favorites', min: 1 },
  },
  {
    id: 'saves-5',
    icon: 'musical-notes',
    label: 'Mélomane',
    description: 'Sauvegarder 5 artistes',
    points: 30,
    condition: { metric: 'favorites', min: 5 },
  },
  {
    id: 'saves-12',
    icon: 'sparkles',
    label: 'Collectionneur',
    description: 'Sauvegarder 12 artistes',
    points: 80,
    condition: { metric: 'favorites', min: 12 },
  },
  {
    id: 'profile',
    icon: 'person',
    label: 'Ambassadeur',
    description: 'Créer son profil',
    points: 20,
    condition: { metric: 'profile', min: 1 },
  },
];

/** Évalue une règle contre l'état de l'utilisateur. */
export function satisfiesRule(rule: BadgeRule, state: BadgeState): boolean {
  switch (rule.metric) {
    case 'cities':
      return state.visitedCitiesCount >= rule.min;
    case 'favorites':
      return state.favoritesCount >= rule.min;
    case 'profile':
      return state.hasProfile;
  }
}

/**
 * Valide le catalogue publié par le CMS (JSON sérialisé) et le convertit en
 * BadgeDef[] sûr. Retourne null si aucune donnée exploitable (l'appelant
 * retombe alors sur DEFAULT_BADGES).
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
    const description = typeof record.description === 'string' ? record.description : '';
    const points =
      typeof record.points === 'number' && Number.isFinite(record.points)
        ? Math.max(0, Math.round(record.points))
        : 0;
    const icon = typeof record.icon === 'string' ? record.icon : '';
    const conditionRaw = record.condition as Record<string, unknown> | undefined;
    const metric = conditionRaw?.metric;
    const min =
      typeof conditionRaw?.min === 'number' && Number.isFinite(conditionRaw.min)
        ? Math.max(0, Math.round(conditionRaw.min))
        : 1;
    if (
      !id ||
      !label ||
      !icon ||
      !(icon in Ionicons.glyphMap) ||
      !(metric === 'cities' || metric === 'favorites' || metric === 'profile') ||
      seen.has(id)
    ) {
      continue;
    }
    seen.add(id);
    valid.push({
      id,
      icon: icon as IconName,
      label,
      description,
      points,
      condition: { metric, min },
    });
  }
  return valid.length > 0 ? valid : null;
}

export interface LevelInfo {
  level: number;
  title: string;
  currentMin: number;
  nextMin: number | null;
  /** Progression 0 → 1 vers le niveau suivant. */
  progress: number;
}

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
