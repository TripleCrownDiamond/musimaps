/**
 * Cohérence géographique — garde contre les données fausses.
 *
 * Fichier volontairement AUTONOME : aucun import de valeur venant d'un autre
 * module. C'est ce qui permet aux scripts Node (`scripts/audit-geo.mjs`) de
 * le charger directement, et de faire tourner exactement la même détection
 * que la carte plutôt qu'une copie qui dériverait.
 */

/** Forme minimale attendue — compatible avec `Artist`. */
export interface GeoLocatable {
  id: string;
  coordinates: [number, number];
}

export function isValidCoordinate(c: unknown): c is [number, number] {
  return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
}

/** Distance approximative entre deux points, en kilomètres (haversine). */
export function distanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Écart minimal au-delà duquel un artiste est suspect, par type de groupe.
 *
 * Calibré sur les données réelles. Un premier essai à 250 km pour tout le
 * monde signalait 5 artistes dont **4 étaient corrects** : Lagos → Port
 * Harcourt fait 443 km et Johannesburg → Cape Town 1 261 km, distances
 * parfaitement normales à l'intérieur d'un pays. Un faux positif coûte cher —
 * il retire un artiste légitime de la carte — donc le seuil « pays » est
 * délibérément large : il ne vise que les erreurs manifestes, du type
 * « Kano, Nigéria » pointant sur Kagoshima au Japon (13 000 km).
 */
export const OUTLIER_FLOOR_KM = {
  /** Membres d'une même ville : ils doivent être proches. */
  city: 150,
  /** Membres d'un même pays : seules les erreurs inter-continentales comptent. */
  country: 3000,
} as const;

export type GeoScope = keyof typeof OUTLIER_FLOOR_KM;
/** Multiplicateur appliqué à la dispersion réelle du groupe. */
export const OUTLIER_SPREAD_FACTOR = 4;
/** En dessous de ce nombre de membres, aucune majorité ne se dégage. */
export const OUTLIER_MIN_GROUP = 3;

export interface GeoSplit<T> {
  /** Membres cohérents avec le groupe. */
  inside: T[];
  /** Membres dont la coordonnée contredit le groupe (donnée probablement fausse). */
  outliers: T[];
}

/** Position médiane d'un groupe — insensible aux aberrants. */
export function medianCentre<T extends GeoLocatable>(items: T[]): [number, number] {
  const valid = items.filter((a) => isValidCoordinate(a.coordinates));
  return [
    median(valid.map((a) => a.coordinates[0])),
    median(valid.map((a) => a.coordinates[1])),
  ];
}

/**
 * Sépare les membres d'un groupe entre cohérents et **aberrants**.
 *
 * Le clustering regroupe par `geoCountryOf(city, country)` — le texte
 * DÉCLARÉ — alors que le pin est posé sur `coordinates`. Quand les deux se
 * contredisent (un artiste de Tripoli enregistré avec « Suède »), il apparaît
 * dans le cluster suédois mais son pin est en Libye : naviguer jusqu'à lui
 * téléporte l'utilisateur à 3 500 km.
 *
 * On ne peut pas valider une coordonnée contre un pays côté client sans
 * embarquer les frontières. Mais dans un groupe, la majorité est bien placée :
 * on prend la position MÉDIANE (insensible aux aberrants, contrairement au
 * barycentre qu'ils déplacent) et on écarte ceux qui en sont trop loin.
 *
 * Le seuil s'adapte à la dispersion réelle du groupe : une grande ville reste
 * serrée, un pays vaste comme la Russie s'étale sans que personne soit
 * signalé à tort.
 */
export function splitGeoOutliers<T extends GeoLocatable>(
  items: T[],
  scope: GeoScope = 'country',
): GeoSplit<T> {
  const valid = items.filter((a) => isValidCoordinate(a.coordinates));
  if (valid.length < OUTLIER_MIN_GROUP) return { inside: items, outliers: [] };

  const centre = medianCentre(valid);
  // Dispersion RÉELLE du groupe : un pays vaste dont les artistes sont
  // vraiment répartis relève lui-même son propre seuil, donc personne n'y
  // est signalé à tort.
  const spread = median(valid.map((a) => distanceKm(a.coordinates, centre)));
  const threshold = Math.max(OUTLIER_FLOOR_KM[scope], spread * OUTLIER_SPREAD_FACTOR);

  const inside: T[] = [];
  const outliers: T[] = [];
  for (const item of items) {
    if (!isValidCoordinate(item.coordinates)) {
      outliers.push(item);
      continue;
    }
    if (distanceKm(item.coordinates, centre) > threshold) outliers.push(item);
    else inside.push(item);
  }
  // Sécurité : si la détection écartait la majorité, c'est elle qui a tort.
  if (inside.length < valid.length / 2) return { inside: items, outliers: [] };
  return { inside, outliers };
}

/** Membres cohérents d'un groupe — raccourci du cas le plus fréquent. */
export function geoConsistent<T extends GeoLocatable>(
  items: T[],
  scope: GeoScope = 'country',
): T[] {
  return splitGeoOutliers(items, scope).inside;
}

/**
 * Distance maximale qu'une flèche de navigation peut faire parcourir, en km.
 *
 * Calibrée sur les données réelles : Lagos → Port Harcourt fait 443 km et
 * Johannesburg → Cape Town 1 261 km — des sauts légitimes à l'intérieur d'un
 * pays, qui doivent passer. Le cas signalé, Stockholm → Tripoli, fait
 * 2 962 km : il doit être bloqué. 1 800 km sépare proprement les deux.
 */
export const MAX_PLACE_JUMP_KM = 1800;

/**
 * Index suivant (ou précédent) qui reste DANS la zone — SECONDE garde.
 *
 * Elle ne cherche PAS à savoir quelles données sont fausses : `splitGeoOutliers`
 * s'en charge, mais c'est statistique et donc faillible — le cas Suède →
 * Tripoli (2 962 km) passait sous son seuil « pays » de 3 000 km.
 *
 * Ici on borne simplement le SAUT : une pression sur la flèche ne peut pas
 * déplacer la caméra de plus de `MAX_PLACE_JUMP_KM` depuis l'artiste courant.
 * C'est une borne dure, indépendante de toute classification, et c'est
 * exactement la promesse « naviguer dans un lieu ne m'en fait pas sortir ».
 *
 * Renvoie `from` si aucun artiste n'est atteignable — on ne bouge pas plutôt
 * que de téléporter l'utilisateur.
 */
export function nextIndexWithinPlace<T extends GeoLocatable>(
  items: T[],
  from: number,
  direction: 1 | -1,
  maxJumpKm: number = MAX_PLACE_JUMP_KM,
): number {
  const count = items.length;
  if (count === 0) return 0;
  const current = items[from];
  if (!current || !isValidCoordinate(current.coordinates)) {
    return (((from + direction) % count) + count) % count;
  }
  // `step < count` et non `<=` : au dernier tour l'index reviendrait sur
  // `from` lui-même, dont la distance vaut 0 — la boucle se serait toujours
  // « validée » sur l'artiste courant et le repli n'aurait jamais servi.
  for (let step = 1; step < count; step += 1) {
    const index = (((from + direction * step) % count) + count) % count;
    const candidate = items[index];
    if (!isValidCoordinate(candidate.coordinates)) continue;
    if (distanceKm(current.coordinates, candidate.coordinates) <= maxJumpKm) return index;
  }
  // Aucun voisin atteignable : c'est qu'on se trouve SUR l'artiste aberrant,
  // isolé du reste du groupe. Plutôt que de figer la navigation, on ramène
  // vers le cœur de la zone — l'artiste le plus proche de la médiane.
  const centre = medianCentre(items);
  let best = from;
  let bestDistance = Infinity;
  items.forEach((item, index) => {
    if (index === from || !isValidCoordinate(item.coordinates)) return;
    const d = distanceKm(item.coordinates, centre);
    if (d < bestDistance) {
      bestDistance = d;
      best = index;
    }
  });
  return best;
}
