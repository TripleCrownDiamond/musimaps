/**
 * Carte / globe — géométrie, clustering, échelle des pins et cibles de caméra.
 *
 * TypeScript pur : ni `mapbox-gl` (web) ni `@rnmapbox/maps` (mobile). Chaque
 * plateforme garde son moteur de rendu et son moteur d'animation, mais lit
 * ici les MÊMES seuils, la même spirale de dés-empilement et les mêmes cibles
 * de caméra.
 *
 * Tout ce fichier existait en double, copié-collé à l'identique entre
 * `GlobeMap.tsx` (web) et `ExploreScreen.tsx` (mobile). Voir docs/AUDIT-CARTE.md.
 */
import type { Artist } from '../index';
import { parseFollowersCount, popularityTier, type PopularityTier } from '../index';

/* ------------------------------------------------------------------ */
/* Coordonnées                                                        */
/* ------------------------------------------------------------------ */

export function isValidCoordinate(c: unknown): c is [number, number] {
  return Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
}

/**
 * Seuil de regroupement local : ~2,2 km (0,02°). Les coordonnées d'artistes
 * sont des géocodages de ville, rarement précis à mieux que ça : ceux qui
 * tombent dans la même « case » sont considérés empilés.
 */
export const SPREAD_BUCKET_DEG = 0.02;

export function bucketKey(coordinates: [number, number]): string {
  return `${Math.round(coordinates[0] / SPREAD_BUCKET_DEG)}|${Math.round(
    coordinates[1] / SPREAD_BUCKET_DEG,
  )}`;
}

/* ------------------------------------------------------------------ */
/* Niveaux de cluster                                                 */
/* ------------------------------------------------------------------ */

export type ClusterLevel = 'country' | 'city' | 'sub' | 'spread';

/**
 * Zoom à partir duquel les pins individuels apparaissent.
 *
 * Valait 9. À ce niveau, deux artistes d'un même point n'étaient séparés que
 * de **9 pixels** alors qu'un pin en fait 36 : ils s'empilaient malgré le
 * dés-empilement. Le décalage géographique étant plafonné (voir
 * `MAX_OFFSET_KM`), il faut atteindre z11 pour que deux pins tiennent côte
 * à côte sans mentir sur la position.
 */
export const SPREAD_ZOOM = 11;

/** Seuils de zoom : monde → pays → ville → sous-groupe → pins individuels. */
export function levelFor(zoom: number): ClusterLevel {
  if (zoom < 3.2) return 'country';
  if (zoom < 6) return 'city';
  if (zoom < SPREAD_ZOOM) return 'sub';
  return 'spread';
}

/* ------------------------------------------------------------------ */
/* Dés-empilement en spirale                                          */
/* ------------------------------------------------------------------ */

/** Angle d'or — répartition homogène et déterministe. */
const GOLDEN_ANGLE = 2.399963229728653;

/** Largeur du monde en pixels chez Mapbox GL (tuiles 512 px). */
function pixelsPerDegree(zoom: number): number {
  return (512 * 2 ** zoom) / 360;
}

/** Séparation visée entre deux pins voisins, en pixels écran. */
const TARGET_SEPARATION_PX = 46;

/**
 * Décalage géographique maximal admis, en kilomètres.
 *
 * C'est une borne de **véracité** : au-delà, on n'écarte plus des pins,
 * on invente une localisation. Voir docs/DECISIONS-PRODUIT.md.
 */
const MAX_OFFSET_KM = 1.5;
const MAX_OFFSET_DEG = (MAX_OFFSET_KM * 1000) / 111_320;

/**
 * Rayon de la spirale pour le i-ème artiste d'un groupe, en degrés.
 *
 * L'ancienne formule faisait CROÎTRE le rayon avec le zoom
 * (`(0.012 + 0.007·√i) × spreadFactor`), alors que le zoom double déjà la
 * séparation en pixels à chaque niveau : les deux effets se multipliaient.
 * Résultat mesuré : 9 px de séparation à z9 (pins empilés) et 995 px à z15
 * (pins hors écran, posés à 2,4 km de la vraie position).
 *
 * On part désormais de la séparation ÉCRAN voulue et on en déduit le rayon
 * géographique — donc l'inverse. La séparation reste constante et lisible à
 * tous les zooms, et le décalage réel DIMINUE quand on s'approche : 1,5 km à
 * z11, 291 m à z15. Plus lisible et plus honnête à la fois.
 */
function spiralRadius(index: number, zoom: number): number {
  const wanted = (TARGET_SEPARATION_PX * (1 + 0.55 * Math.sqrt(index))) / pixelsPerDegree(zoom);
  return Math.min(MAX_OFFSET_DEG, wanted);
}

/**
 * Écarte les pins empilés (même point géocodé) en spirale déterministe.
 * Tri par nom → le décalage est stable entre deux rendus, et chaque pin
 * reste dans un rayon honnête autour de la vraie position.
 *
 * Le rayon grandit AVEC le zoom : serré à z9 (vue d'ensemble), ouvert à
 * z14+ pour des pins nettement séparés, sans jamais inventer de position
 * au-delà de ~1-2 km.
 */
export function declump(artists: Artist[], zoom: number): Map<string, [number, number]> {
  const groups = new Map<string, Artist[]>();
  for (const artist of artists) {
    if (!isValidCoordinate(artist.coordinates)) continue;
    const key = bucketKey(artist.coordinates);
    const group = groups.get(key);
    if (group) group.push(artist);
    else groups.set(key, [artist]);
  }
  const out = new Map<string, [number, number]>();
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.set(group[0].id, group[0].coordinates);
      continue;
    }
    group.sort((a, b) => a.name.localeCompare(b.name));
    const cLng = group.reduce((s, a) => s + a.coordinates[0], 0) / group.length;
    const cLat = group.reduce((s, a) => s + a.coordinates[1], 0) / group.length;
    group.forEach((artist, i) => {
      const angle = i * GOLDEN_ANGLE;
      const radius = spiralRadius(i, zoom);
      // La longitude se resserre avec la latitude : sans cette correction,
      // deux pins séparés de 46 px à l'équateur n'en font plus que 20 à
      // Oslo. On divise par cos(lat) pour garder la séparation à l'écran.
      const lngScale = Math.max(0.25, Math.cos((cLat * Math.PI) / 180));
      out.set(artist.id, [
        cLng + (Math.cos(angle) * radius) / lngScale,
        Math.min(85, Math.max(-85, cLat + Math.sin(angle) * radius)),
      ]);
    });
  }
  return out;
}

/**
 * Position AFFICHÉE d'un artiste au zoom cible, dés-empilement inclus.
 *
 * C'est la fonction qui manquait aux deux plateformes : `goToArtist` volait
 * vers la coordonnée BRUTE, alors qu'à z13 la spirale peut décaler le pin de
 * plusieurs centaines de pixels. On centrait donc la caméra sur un point où
 * il n'y avait pas de pin.
 */
export function renderedPosition(
  artists: Artist[],
  id: string,
  zoom: number,
): [number, number] | undefined {
  const target = artists.find((a) => a.id === id);
  if (!target || !isValidCoordinate(target.coordinates)) return undefined;
  return declump(artists, zoom).get(id) ?? target.coordinates;
}

/** Position affichée du PREMIER artiste valide — clic sur cluster, recherche de lieu. */
export function firstRenderedPosition(
  artists: Artist[],
  zoom: number,
): { id: string; coordinates: [number, number] } | undefined {
  const first = artists.find((a) => isValidCoordinate(a.coordinates));
  if (!first) return undefined;
  const spread = declump(artists, zoom);
  return { id: first.id, coordinates: spread.get(first.id) ?? first.coordinates };
}

/* ------------------------------------------------------------------ */
/* Popularité et apparence des pins                                   */
/* ------------------------------------------------------------------ */

export type PopularityMap = Map<string, number>;

/** Niveau de popularité d'un artiste (score réel sinon abonnés parsés). */
export function tierOf(artist: Artist, popularityById?: PopularityMap): PopularityTier {
  const real = popularityById?.get(artist.id);
  const count = real && real > 0 ? real : (parseFollowersCount(artist.followers) ?? 0);
  return popularityTier(count);
}

/**
 * Facteur de taille par notoriété.
 *
 * Avant, le tier ne pilotait que la COULEUR : deux artistes au même endroit,
 * l'un à 3 M d'auditeurs et l'autre à 200, avaient exactement le même
 * diamètre. En vue globe, la carte ne racontait rien.
 */
export const TIER_SIZE_FACTOR: Record<PopularityTier, number> = {
  0: 0.72,
  1: 0.88,
  2: 1.06,
  3: 1.3,
};

/** Échelle de base liée au zoom : minuscule de loin, pleine taille à l'approche. */
export function pinZoomScale(zoom: number): number {
  return Math.min(1.15, Math.max(0.22, 0.22 + (zoom - 1) * 0.07));
}

/** Échelle finale d'un pin : zoom × notoriété. */
export function pinScaleFor(zoom: number, tier: PopularityTier): number {
  return pinZoomScale(zoom) * TIER_SIZE_FACTOR[tier];
}

/** Opacité du pin selon le zoom (pins discrets en vue globe). */
export function pinOpacityFor(zoom: number): number {
  return Math.min(1, Math.max(0.5, 0.5 + (zoom - 1) * 0.06));
}

/**
 * Intensité du halo (0 → 1). Elle croît plus vite que le diamètre : en vue
 * globe, où le point fait déjà 8 px, la notoriété se lit au rayonnement.
 */
export function pinGlowFor(zoom: number, tier: PopularityTier): number {
  const base = 0.35 + tier * 0.22;
  return Math.min(1, base * Math.min(1, Math.max(0.45, zoom / 6)));
}

/** Convertit une couleur hex en rgba (halo lumineux des pins). */
export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = Number.parseInt(h, 16);
  if (!Number.isFinite(n)) return hex;
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Regroupement par lieu                                              */
/* ------------------------------------------------------------------ */

export interface Cluster {
  key: string;
  label: string;
  flag: string;
  count: number;
  coordinates: [number, number];
}

/** Regroupe des artistes par clé (pays ou ville) et calcule le barycentre. */
export function clusterBy(artists: Artist[], keyOf: (a: Artist) => string): Cluster[] {
  const map = new Map<
    string,
    { label: string; flag: string; count: number; lng: number; lat: number }
  >();
  for (const artist of artists) {
    const coords = artist.coordinates;
    if (!isValidCoordinate(coords)) continue;
    const key = keyOf(artist) || 'unknown';
    const current = map.get(key);
    if (current) {
      current.count += 1;
      current.lng += coords[0];
      current.lat += coords[1];
    } else {
      map.set(key, {
        label: key === 'unknown' ? '' : key,
        flag: artist.flag,
        count: 1,
        lng: coords[0],
        lat: coords[1],
      });
    }
  }
  return [...map.entries()].map(([key, c]) => ({
    key,
    label: c.label,
    flag: c.flag,
    count: c.count,
    coordinates: [c.lng / c.count, c.lat / c.count] as [number, number],
  }));
}

/* ------------------------------------------------------------------ */
/* Caméra                                                             */
/* ------------------------------------------------------------------ */

export interface CameraTarget {
  zoom: number;
  duration: number;
}

/**
 * Cibles de caméra — UNE table pour les deux plateformes.
 *
 * Ces valeurs étaient des littéraux dispersés dans les points d'appel, et
 * elles avaient divergé : `goToArtist` volait à **z13 sur web et z9 sur
 * mobile**, sur l'action la plus fréquente de l'app. Or z9 est exactement la
 * frontière sub/spread : on atterrissait avant que les pins soient dés-empilés.
 *
 * Les durées mobiles étaient aussi 3× plus courtes (800-950 ms contre
 * 1400-2600), ce qui ne laissait pas aux clusters le temps de se scinder.
 */
export const CAMERA: Record<
  'artist' | 'city' | 'place' | 'country' | 'genre' | 'sub' | 'globe',
  CameraTarget
> = {
  artist: { zoom: 13, duration: 1400 },
  city: { zoom: 13, duration: 1600 },
  place: { zoom: 14, duration: 1600 },
  country: { zoom: 12, duration: 1600 },
  genre: { zoom: 11, duration: 1600 },
  sub: { zoom: 13.5, duration: 1400 },
  globe: { zoom: 0.75, duration: 2000 },
};

/** Zoom au-delà duquel la barre de recherche se replie en icône. */
export const SEARCH_COLLAPSE_ZOOM = 3.2;

/** Zoom à partir duquel le nom d'un pin s'affiche en permanence (tactile). */
export const PIN_LABEL_ZOOM = 12.5;

/**
 * Zoom maximal autorisé — **contrainte de vie privée, pas un réglage d'UI**.
 *
 * Les coordonnées d'artistes sont des géocodages de VILLE, auxquels
 * `declump` ajoute une spirale de ~1 à 2 km. Au-delà du niveau quartier, la
 * carte afficherait donc :
 *   - une précision FAUSSE pour la plupart des artistes (le pin ne
 *     correspond à aucune adresse réelle) ;
 *   - une précision RÉELLE et non souhaitée pour ceux dont la coordonnée
 *     serait fine — on exposerait leur domicile.
 *
 * z15 correspond au quartier, la granularité du champ `district`. C'est le
 * plus loin qu'on puisse aller sans prétendre situer quelqu'un à la rue.
 * Ne pas remonter cette valeur sans décision produit explicite.
 */
export const MAX_ZOOM = 15;

/** Centre et zoom de la vue globe au repos. */
export const GLOBE_CENTER: [number, number] = [2.4, 8];

/**
 * Vitesse de rotation automatique du globe, en degrés de longitude par
 * SECONDE — et non par frame ou par tick.
 *
 * Les deux plateformes exprimaient leur vitesse dans leur propre unité et
 * avaient largement divergé :
 *   web    : −0,06° par frame à 60 fps  → −3,6 °/s
 *   mobile : −0,12° par tick de 120 ms  → −1,0 °/s
 * Le web tournait donc 3,6× plus vite. Une valeur en °/s rend la rotation
 * identique ET indépendante de la cadence de rafraîchissement : un appareil
 * qui rame ralentit l'image, pas le globe.
 */
export const GLOBE_SPIN_DEG_PER_SEC = 3.6;

/**
 * Intervalle cible entre deux pas de rotation sur mobile, en millisecondes.
 * 120 ms donnait 8 images par seconde — visiblement saccadé à côté des 60 fps
 * du web. 33 ms vise 30 fps, fluide sans épuiser la batterie.
 */
export const GLOBE_SPIN_TICK_MS = 33;

/** Déplacement de longitude pour un intervalle écoulé donné. */
export function spinDeltaFor(elapsedMs: number): number {
  // Borne haute : après un retour d'arrière-plan, `elapsed` peut valoir
  // plusieurs secondes — le globe ferait un saut brutal.
  const capped = Math.min(elapsedMs, 250);
  return (GLOBE_SPIN_DEG_PER_SEC * capped) / 1000;
}
