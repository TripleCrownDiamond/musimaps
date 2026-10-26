/**
 * « Votre artiste du jour » — choix des artistes proposés chaque jour.
 *
 * Module pur (ni plateforme, ni réseau) : l'app mobile programme ses
 * notifications locales à partir de cette liste. Les plus proches d'abord
 * (rayon de découverte), puis le même pays, puis le reste de la carte, en
 * écartant les artistes déjà favoris ou déjà proposés. L'ordre varie d'un
 * jour à l'autre mais reste stable pour un même jour (pas de surprise si
 * l'app reprogramme deux fois dans la journée).
 */
import { geoCountryOf } from '../geo';
import { distanceKm } from '../map/geo-consistency';
import { LOCATION_DISCOVERY_RADIUS_KM } from '../map/location';

/** Heure locale de la notification quotidienne. */
export const DAILY_DISCOVERY_HOUR = 18;
/** Nombre de jours programmés d'avance à chaque ouverture de l'app. */
export const DAILY_DISCOVERY_DAYS = 7;
/** Nombre d'artistes déjà proposés gardés en mémoire pour ne pas se répéter. */
export const DAILY_DISCOVERY_MEMORY = 60;
/** Temps d'exploration avant de proposer l'artiste du jour (une seule fois). */
export const DAILY_PROMPT_DELAY_MS = 20_000;

export interface DailyCandidate {
  id: string;
  city: string;
  country?: string | null;
  coordinates: [number, number];
}

/** Graine stable d'une journée (`2026-10-26` → nombre). */
function daySeed(dayKey: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash ^= dayKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mélange déterministe (mulberry32) : même graine, même ordre. */
function seededShuffle<T>(items: T[], seed: number): T[] {
  let state = seed || 1;
  const random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Artistes à proposer, un par jour, dans l'ordre.
 *
 * `origin` : position de l'appareil, ou à défaut celle de la ville du profil ;
 * `null` = aucune idée du lieu, on pioche dans toute la carte.
 */
export function pickDailyArtists<T extends DailyCandidate>(
  artists: T[],
  origin: { coordinates: [number, number]; countryCode?: string | null } | null,
  options: { exclude?: Iterable<string>; count?: number; dayKey: string },
): T[] {
  const count = options.count ?? DAILY_DISCOVERY_DAYS;
  const excluded = new Set(options.exclude ?? []);
  const pool = artists.filter((artist) => !excluded.has(artist.id));
  const seed = daySeed(options.dayKey);

  const tiers: T[][] = [];
  if (origin) {
    const near = pool.filter((artist) => distanceKm(origin.coordinates, artist.coordinates) <= LOCATION_DISCOVERY_RADIUS_KM);
    const country = origin.countryCode?.toUpperCase();
    const sameCountry = country
      ? pool.filter((artist) => !near.includes(artist) && geoCountryOf(artist.city, artist.country ?? '') === country)
      : [];
    tiers.push(near, sameCountry);
  }
  tiers.push(pool);

  const picked: T[] = [];
  const seen = new Set<string>();
  for (const tier of tiers) {
    for (const artist of seededShuffle(tier, seed)) {
      if (picked.length >= count) return picked;
      if (seen.has(artist.id)) continue;
      seen.add(artist.id);
      picked.push(artist);
    }
  }
  return picked;
}

/** Clé de journée locale `AAAA-MM-JJ` d'une date. */
export function dayKeyOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Dates des prochaines notifications : aujourd'hui à l'heure prévue si elle
 * n'est pas encore passée (sinon demain), puis chaque jour suivant.
 */
export function nextDailySlots(now: Date, days = DAILY_DISCOVERY_DAYS, hour = DAILY_DISCOVERY_HOUR): Date[] {
  const first = new Date(now);
  first.setHours(hour, 0, 0, 0);
  if (first.getTime() <= now.getTime()) first.setDate(first.getDate() + 1);
  return Array.from({ length: days }, (_, index) => {
    const slot = new Date(first);
    slot.setDate(first.getDate() + index);
    return slot;
  });
}
