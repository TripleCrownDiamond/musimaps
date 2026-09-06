/**
 * Pertinence de la recherche d'artistes.
 *
 * `searchArtistOnline` interroge MusicBrainz puis Wikipedia et dédoublonne par
 * nom — mais ne trie rien. Les résultats arrivaient donc dans l'ordre brut des
 * fournisseurs : chercher « Booba Paris » pouvait remonter un homonyme d'un
 * autre pays avant l'artiste visé, et une fiche sans coordonnées — donc
 * impossible à poser sur la carte — se retrouvait en tête.
 *
 * Ce module note chaque résultat sur trois axes :
 *
 *   1. le NOM — égalité exacte, préfixe, inclusion, tous les mots présents ;
 *   2. le LIEU — quand la requête nomme une ville ou un pays, l'artiste qui y
 *      correspond monte, celui qui le contredit descend ;
 *   3. la QUALITÉ — un artiste plaçable, illustré et décrit passe devant une
 *      fiche vide à pertinence égale.
 *
 * Tout est pur : aucun appel réseau, aucune dépendance de plateforme. La
 * détection de lieu ne s'appuie sur aucune liste de villes figée — un mot de
 * la requête est un lieu s'il désigne un pays connu, ou s'il correspond à la
 * ville de l'un des résultats. La recherche apprend donc du corpus renvoyé.
 */
import { countryByName } from '../geo';
// `normalize` vit dans `music.ts` : c'est la même vérité produit — comment on
// compare deux noms d'artistes, accents et ligatures compris.
import { normalize } from './music';

/** Ce que le classement a besoin de connaître d'un artiste. */
export interface RankableArtist {
  name: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  image?: string;
  bio?: string;
  verified?: boolean;
}

export interface RankedArtist<T extends RankableArtist> {
  artist: T;
  /** Score final, borné [0, 1]. */
  score: number;
  /** Un artiste sans coordonnées ne peut pas être posé sur la carte. */
  placeable: boolean;
  /** Pourquoi ce rang — lisible en admin, vérifiable en test. */
  reasons: string[];
}

/** Poids des trois axes. Leur somme vaut 1 : le score reste comparable. */
const WEIGHT_NAME = 0.6;
const WEIGHT_PLACE = 0.3;
const WEIGHT_QUALITY = 0.1;

/**
 * En dessous, le résultat n'a rien à voir avec la requête : ni le nom, ni le
 * lieu ne correspondent. Le laisser passer nuit plus qu'un résultat manquant.
 */
export const MIN_RELEVANCE = 0.2;

/**
 * Score de correspondance textuelle pour les listes de recherche locales.
 * Une égalité exacte ou un préfixe passe avant une simple inclusion ; le score
 * est volontairement pur pour que web et mobile trient les mêmes éléments.
 */
export function searchRelevance(value: string | null | undefined, query: string): number {
  const candidate = normalize(value ?? '').trim();
  const needle = normalize(query).trim();
  if (!candidate || !needle) return 0;
  if (candidate === needle) return 1;
  if (candidate.startsWith(needle)) return 0.9;
  const words = needle.split(' ').filter(Boolean);
  if (words.length > 1 && words.every((word) => candidate.includes(word))) return 0.8;
  if (candidate.includes(needle)) return 0.7;
  return 0;
}

/** Trie un type de résultat en conservant l’ordre d’origine à score égal. */
export function rankSearchResults<T>(
  results: T[],
  query: string,
  primary: (result: T) => string | null | undefined,
  secondary?: (result: T) => string | null | undefined,
): T[] {
  return results
    .map((result, index) => ({
      result,
      index,
      score: Math.max(
        searchRelevance(primary(result), query),
        secondary ? searchRelevance(secondary(result), query) * 0.85 : 0,
      ),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ result }) => result);
}


/** Mots trop courants pour désigner un lieu dans une requête. */
const STOP_WORDS = new Set(['de', 'du', 'la', 'le', 'les', 'des', 'the', 'of', 'and', 'et']);

/**
 * Repère dans une requête les mots qui désignent un lieu.
 *
 * Deux sources, sans liste de villes à maintenir :
 *   - les noms de pays connus de `geo` ;
 *   - les villes portées par les résultats eux-mêmes — si un mot de la requête
 *     est la ville d'un candidat, c'est que l'utilisateur parle bien d'un lieu.
 */
export function parsePlaceTokens(query: string, knownCities: string[] = []): string[] {
  const tokens = normalize(query)
    .split(' ')
    .filter((t) => t && !STOP_WORDS.has(t));
  const cityTokens = new Set(
    knownCities.flatMap((c) => normalize(c).split(' ')).filter((t) => t && !STOP_WORDS.has(t)),
  );
  return tokens.filter((token) => Boolean(countryByName(token)) || cityTokens.has(token));
}

/** Note la correspondance entre le nom cherché et le nom de l'artiste. */
function scoreName(artistName: string, nameQuery: string): { score: number; reason: string } {
  const a = normalize(artistName);
  const q = nameQuery.trim();
  if (!q) return { score: 0.5, reason: 'aucun nom dans la requête' };
  if (!a) return { score: 0, reason: 'artiste sans nom' };
  if (a === q) return { score: 1, reason: 'nom exact' };
  if (a.startsWith(`${q} `)) return { score: 0.85, reason: 'commence par le nom cherché' };
  if (a.includes(q)) return { score: 0.7, reason: 'contient le nom cherché' };
  const words = q.split(' ').filter(Boolean);
  if (words.length > 1 && words.every((w) => a.includes(w))) {
    return { score: 0.55, reason: 'tous les mots présents' };
  }
  return { score: 0, reason: 'nom sans rapport' };
}

/**
 * Note la cohérence géographique.
 *
 * Sans lieu dans la requête, l'axe est neutre — on ne pénalise pas un artiste
 * parce que l'utilisateur n'a pas précisé d'où il vient. Avec un lieu, la
 * contradiction coûte cher : c'est le cas de l'homonyme d'un autre pays.
 */
function scorePlace(
  artist: RankableArtist,
  placeTokens: string[],
): { score: number; reason: string; contradicts: boolean } {
  if (placeTokens.length === 0) {
    return { score: 0.5, reason: 'aucun lieu demandé', contradicts: false };
  }
  const city = normalize(artist.city ?? '');
  const country = normalize(artist.country ?? '');
  const inCity = placeTokens.some((t) => city.includes(t));
  const inCountry = placeTokens.some((t) => country.includes(t));
  if (inCity) return { score: 1, reason: `ville cohérente (${artist.city})`, contradicts: false };
  if (inCountry) {
    return { score: 0.75, reason: `pays cohérent (${artist.country})`, contradicts: false };
  }
  // Sans lieu enregistré, l'artiste ne contredit rien : on ne peut pas
  // l'exclure sur une donnée absente, il descend simplement dans la liste.
  if (!city && !country) {
    return { score: 0.25, reason: 'lieu de l’artiste inconnu', contradicts: false };
  }
  return {
    score: 0,
    reason: `lieu contredit (${artist.city || '?'}, ${artist.country || '?'})`,
    contradicts: true,
  };
}

/** Un artiste posable sur la carte, illustré et décrit passe devant une fiche vide. */
function scoreQuality(artist: RankableArtist): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (isPlaceable(artist)) {
    score += 0.5;
    reasons.push('plaçable sur la carte');
  } else {
    reasons.push('sans coordonnées');
  }
  if (artist.image) {
    score += 0.2;
    reasons.push('avec photo');
  }
  if (artist.bio && artist.bio.length >= 60) {
    score += 0.2;
    reasons.push('biographie renseignée');
  }
  if (artist.verified) {
    score += 0.1;
    reasons.push('vérifié');
  }
  return { score, reasons };
}

/**
 * Vrai si l'artiste porte des coordonnées exploitables. `0,0` est le point nul
 * de l'Atlantique : c'est un défaut de géocodage, pas une position.
 */
export function isPlaceable(artist: RankableArtist): boolean {
  const { lat, lng } = artist;
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Classe des résultats de recherche du plus au moins pertinent.
 *
 * Les résultats sous `MIN_RELEVANCE` sont écartés. À score égal, l'artiste
 * plaçable passe devant — c'est lui que l'utilisateur pourra ajouter à la carte.
 */
export function rankArtistResults<T extends RankableArtist>(
  results: T[],
  query: string,
): RankedArtist<T>[] {
  const q = query.trim();
  if (!q) return [];

  const placeTokens = parsePlaceTokens(
    q,
    results.map((r) => r.city ?? '').filter(Boolean),
  );
  // Le nom cherché, c'est la requête moins les mots de lieu : « Booba Paris »
  // se compare à « booba », pas à « booba paris » qui ne matcherait jamais.
  const nameQuery = normalize(q)
    .split(' ')
    .filter((t) => t && !placeTokens.includes(t))
    .join(' ');

  return results
    .map((artist) => {
      const name = scoreName(artist.name, nameQuery);
      const place = scorePlace(artist, placeTokens);
      const quality = scoreQuality(artist);
      // Deux disqualifications franches, avant toute pondération :
      //  - l'utilisateur a tapé un nom et celui-ci ne correspond en rien. Sans
      //    ce garde-fou, la seule note de qualité suffisait à faire passer le
      //    seuil, et un artiste sans aucun rapport restait dans la liste ;
      //  - l'utilisateur a nommé un lieu et l'artiste en indique un autre.
      //    C'est la cohérence ville/pays : l'homonyme d'un autre pays sort.
      const disqualified = (Boolean(nameQuery) && name.score === 0) || place.contradicts;
      const score = disqualified
        ? 0
        : name.score * WEIGHT_NAME + place.score * WEIGHT_PLACE + quality.score * WEIGHT_QUALITY;
      return {
        artist,
        score: Math.min(1, Math.max(0, score)),
        placeable: isPlaceable(artist),
        reasons: [name.reason, place.reason, ...quality.reasons],
      };
    })
    .filter((r) => r.score >= MIN_RELEVANCE)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.placeable !== b.placeable) return a.placeable ? -1 : 1;
      return a.artist.name.localeCompare(b.artist.name);
    });
}
