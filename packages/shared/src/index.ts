export type Coordinates = [longitude: number, latitude: number];

export * from './geo'


export interface Track {
  title: string;
  duration: string;
}

export interface ArtistEvent {
  label: string;
  venue: string;
  date: string;
}

export interface Artist {
  id: string;
  name: string;
  genre: string;
  city: string;
  country: string;
  flag: string;
  coordinates: Coordinates;
  bio: string;
  followers: string;
  color: [string, string];
  trending?: boolean;
  /** Photo HD de l'artiste (Wikipedia), affichée sur la fiche. */
  image?: string;
  /** Quartier / district de l'artiste (ex. « Yopougon », « Bastille ») —
   *  disperse les pins d'une même ville et ancre la localisation réelle. */
  district?: string;
  verified?: boolean;
  /** Plateformes d'écoute publiques (YouTube, Spotify, Apple Music…). */
  platforms?: Partial<Record<string, string>>;
  /** Réseaux sociaux de l'artiste. */
  socials?: Partial<Record<string, string>>;
  /** Source : 'catalog' (éditorial) ou 'musicbrainz' (découvert). */
  source?: 'catalog' | 'musicbrainz' | string;
  /** Profil revendiqué par un compte artiste (id utilisateur). */
  claimedBy?: string | null;
  tracks: Track[];
  events: ArtistEvent[];
}

export type WaitlistProfile = 'artiste' | 'amateur';

export interface WaitlistEntry {
  email: string;
  profile: WaitlistProfile;
  artistName?: string;
  city?: string;
  genre?: string;
  link?: string;
  bio?: string;
  photo?: string;
  spotify?: string;
  youtube?: string;
  instagram?: string;
  createdAt?: string;
}

// Catalogue éditorial : uniquement des artistes réels. Les artistes
// supplémentaires sont ajoutés à la carte via la recherche MusicBrainz
// (le « scraper » du globe), puis validés/corrigés dans l'admin.
export const artists: Artist[] = [
  {
    id: 'omah-lay',
    name: 'Omah Lay',
    genre: 'Afrobeats',
    city: 'Lagos',
    country: 'Nigeria',
    flag: '🇳🇬',
    coordinates: [3.3792, 6.5244],
    bio: 'Auteur-compositeur à la voix feutrée, entre afrobeats atmosphérique, soul et pop nocturne.',
    followers: '4,8 M',
    color: ['#E8B895', '#5C2D2E'],
    trending: true,
    verified: true,
    tracks: [
      { title: 'Soso', duration: '3:03' },
      { title: 'Understand', duration: '2:57' },
      { title: 'Reason', duration: '2:28' },
    ],
    events: [{ label: 'Homecoming Live', venue: 'Victoria Island', date: '18 août' }],
  },
];

export const cities = Array.from(
  artists
    .reduce((map, artist) => {
      const key = `${artist.city}-${artist.country}`;
      const current = map.get(key);
      if (current) current.count += 1;
      else
        map.set(key, {
          city: artist.city,
          country: artist.country,
          flag: artist.flag,
          coordinates: artist.coordinates,
          count: 1,
        });
      return map;
    }, new Map<string, { city: string; country: string; flag: string; coordinates: Coordinates; count: number }>())
    .values(),
);

/**
 * Convertit une chaîne d'abonnés (« 4,8 M », « 850 K », « 123 456 », « — »)
 * en nombre. Renvoie 0 pour les valeurs inconnues/absentes.
 */
export function parseFollowersCount(followers: string | undefined | null): number {
  if (!followers) return 0;
  const normalized = followers.trim().replace(/[\s\u00a0]/g, '');
  if (!normalized || normalized === '—' || normalized === '-') return 0;
  const m = normalized.match(/^([\d.,]+)\s*([MK])?$/i);
  if (!m) return 0;
  const num = Number(m[1].replace(/,/g, '.').replace(/\.(?=\d{3}\b)/g, '')) || 0;
  if (m[2] && m[2].toUpperCase() === 'M') return num * 1_000_000;
  if (m[2] && m[2].toUpperCase() === 'K') return num * 1_000;
  return num;
}

export type PopularityTier = 0 | 1 | 2 | 3;

/**
 * Niveau de popularité d'un artiste : 0 (faible) → 3 (très populaire).
 * Seuils alignés sur le design system (rings discrets, jamais criards).
 */
export function popularityTier(count: number): PopularityTier {
  if (count >= 1_000_000) return 3;
  if (count >= 100_000) return 2;
  if (count >= 10_000) return 1;
  return 0;
}

/** Couleur de l'anneau de popularité par niveau (design system Musimaps). */
export const POPULARITY_RING_COLORS: Record<PopularityTier, string> = {
  0: '#7C8698', // faible — gris neutre
  1: '#2F52E0', // moyen — bleu de marque
  2: '#1E3AA8', // élevé — bleu profond
  3: '#A8FF35', // très populaire — lime accent
};

/**
 * Nombre compact lisible : « 850 », « 12 K », « 3,5 M ».
 * À partir de 10 000, on bascule sur la notation K (jamais en dessous).
 * Utilisé pour les stats des clusters, abonnés, etc. (parité web + mobile).
 */
export function compactCount(value: number): string {
  const n = Math.round(value || 0)
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `${m >= 10 ? Math.round(m) : m.toFixed(1).replace('.', ',')} M`
  }
  if (n >= 10_000) return `${Math.round(n / 1_000)} K`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')} K`
  return String(n)
}

export type PasswordLevel = 'none' | 'short' | 'weak' | 'medium' | 'strong';

export interface PasswordStrength {
  /** 0 (trop court) à 3 (fort) — sert à remplir la jauge. */
  score: 0 | 1 | 2 | 3;
  level: PasswordLevel;
}

/**
 * Jauge de force d'un mot de passe (partagée web + mobile).
 * 8 caractères minimum, + longueur 12, + variété (casse, chiffres, symboles).
 */
export function passwordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, level: 'none' };
  if (password.length < 8) return { score: 0, level: 'short' };
  let score = 1;
  if (password.length >= 12) score += 1;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const variety = [hasUpper && hasLower, hasDigit, hasSymbol].filter(Boolean).length;
  if (variety >= 2) score += 1;
  if (variety >= 3) score += 1;
  const capped = Math.min(score, 3) as 1 | 2 | 3;
  const level: PasswordLevel = capped === 1 ? 'weak' : capped === 2 ? 'medium' : 'strong';
  return { score: capped, level };
}

export function searchAll(query: string) {
  const normalized = query.trim().toLocaleLowerCase('fr');
  if (!normalized) return { artists: [], cities: [] };
  return {
    artists: artists.filter((artist) =>
      [artist.name, artist.city, artist.country, artist.genre].some((value) =>
        value.toLocaleLowerCase('fr').includes(normalized),
      ),
    ),
    cities: cities.filter((city) =>
      `${city.city} ${city.country}`.toLocaleLowerCase('fr').includes(normalized),
    ),
  };
}

export function searchArtists(query: string) {
  return searchAll(query).artists;
}

export function findArtist(id: string) {
  return artists.find((artist) => artist.id === id);
}
