import type { Artist } from '../index';
import { isValidCoordinate } from './geo-consistency';
import type { ClusterLevel } from './index';
import { bucketKey, clusterAnchor } from './index';

/**
 * Éclatement d'un groupe en pins — même chorégraphie web et mobile.
 *
 * Le zoom vers une zone atterrit sur la pastille « N artistes » ; ce n'est
 * qu'une fois la caméra immobile que les pins sortent de la pastille et
 * filent vers leur place en spirale, pendant que la pastille s'efface.
 * Avant, les pins individuels remplaçaient la pastille dès que le zoom
 * franchissait `SPREAD_ZOOM`, au milieu du vol : on ne voyait jamais le
 * groupe s'ouvrir.
 */
export const PIN_BURST = {
  /** Trajet d'un pin, de la pastille à sa place. */
  durationMs: 560,
  /** Décalage entre deux pins d'un même groupe : ils sortent en cascade. */
  staggerMs: 16,
  /** Plafond de la cascade : un groupe de 80 ne doit pas traîner. */
  maxStaggerMs: 320,
  /** Disparition de la pastille. */
  clusterFadeMs: 260,
  /** Sans nouvel événement caméra pendant ce délai, le zoom est considéré
   *  arrêté (Android n'émet pas toujours `onMapIdle` après l'inertie). */
  settleQuietMs: 220,
} as const;

/** Durée totale d'un éclatement, cascade comprise. */
export const PIN_BURST_TOTAL_MS = PIN_BURST.durationMs + PIN_BURST.maxStaggerMs;

/**
 * Le passage aux pins individuels attend l'arrêt de la caméra.
 *
 * Seule l'entrée dans `spread` est retenue : dézoomer regroupe aussitôt, et
 * un déplacement qui reste au niveau des pins (flèches entre artistes) ne
 * rejoue rien.
 */
export function shouldHoldSpread(current: ClusterLevel, next: ClusterLevel): boolean {
  return next === 'spread' && current !== 'spread';
}

export interface BurstOrigin {
  /** Position de la pastille dont le pin sort. */
  from: [number, number];
  /** Rang du pin dans son groupe : ordre de la cascade. */
  index: number;
}

export interface BurstCluster {
  key: string;
  coordinates: [number, number];
  count: number;
  /** Membres du groupe : la pastille garde la couleur de leur notoriété. */
  members: Artist[];
}

/**
 * D'où sort chaque pin : la pastille de son groupe au niveau `sub`.
 *
 * Mêmes groupes que le niveau `sub` (case de ~2 km, ordre alphabétique, ancre
 * sur un artiste réel) : le pin part exactement de la pastille qu'on voyait.
 * Un artiste seul dans sa case n'avait pas de pastille — il reste en place.
 */
export function burstOrigins(artists: Artist[]): {
  origins: Map<string, BurstOrigin>;
  clusters: BurstCluster[];
} {
  const groups = new Map<string, Artist[]>();
  for (const artist of artists) {
    if (!isValidCoordinate(artist.coordinates)) continue;
    const key = bucketKey(artist.coordinates);
    const group = groups.get(key);
    if (group) group.push(artist);
    else groups.set(key, [artist]);
  }
  const origins = new Map<string, BurstOrigin>();
  const clusters: BurstCluster[] = [];
  for (const [key, group] of groups) {
    if (group.length < 2) continue;
    group.sort((a, b) => a.name.localeCompare(b.name));
    const from = clusterAnchor(group);
    clusters.push({ key, coordinates: from, count: group.length, members: group });
    group.forEach((artist, index) => {
      if (!origins.has(artist.id)) origins.set(artist.id, { from, index });
    });
  }
  return { origins, clusters };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Sortie avec léger dépassement : le pin file puis se pose. */
function easeOutBack(x: number, overshoot = 1.2): number {
  const c = overshoot + 1;
  return 1 + c * (x - 1) ** 3 + overshoot * (x - 1) ** 2;
}

export interface BurstFrame {
  /** Avancement du trajet, 0 = pastille, 1 = place (dépasse légèrement 1). */
  travel: number;
  scale: number;
  opacity: number;
  done: boolean;
}

/** État d'un pin `elapsedMs` après le début de l'éclatement. */
export function burstFrame(elapsedMs: number, index: number): BurstFrame {
  const delay = Math.min(PIN_BURST.maxStaggerMs, index * PIN_BURST.staggerMs);
  const x = clamp01((elapsedMs - delay) / PIN_BURST.durationMs);
  return {
    travel: x <= 0 ? 0 : easeOutBack(x),
    scale: 0.35 + 0.65 * clamp01(easeOutBack(clamp01(x * 1.6), 1.6)),
    opacity: clamp01(x * 4),
    done: x >= 1,
  };
}

/** La pastille gonfle un instant puis se résorbe. */
export function burstClusterFrame(elapsedMs: number): { scale: number; opacity: number; done: boolean } {
  const x = clamp01(elapsedMs / PIN_BURST.clusterFadeMs);
  const scale = x < 0.25 ? 1 + 0.12 * (x / 0.25) : 1.12 * (1 - ((x - 0.25) / 0.75) ** 2);
  return { scale: Math.max(0, scale), opacity: 1 - x * x, done: x >= 1 };
}

/** Interpolation géographique (distances de quelques km : linéaire suffit). */
export function lerpCoordinate(
  from: [number, number],
  to: [number, number],
  k: number,
): [number, number] {
  return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k];
}
