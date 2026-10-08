import Mapbox from '@rnmapbox/maps';
import { useEffect, useSyncExternalStore, type ReactElement } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import {
  burstClusterFrame,
  burstFrame,
  lerpCoordinate,
  PIN_BURST_TOTAL_MS,
  type BurstOrigin,
} from '@musimaps/shared';

/**
 * Horloge de l'éclatement des groupes en pins (chorégraphie dans
 * `@musimaps/shared/map/burst`).
 *
 * Une seule horloge pour tous les pins : seuls les markers abonnés se
 * redessinent à chaque frame, jamais l'écran de la carte entier.
 *   - armed   : le niveau « pins » vient d'être atteint, ils attendent sur la
 *               pastille (évite un rendu à leur place finale avant le départ) ;
 *   - running : ils filent vers leur place ;
 *   - idle    : rendu normal.
 */
type Phase = 'idle' | 'armed' | 'running';
let phase: Phase = 'idle';
let startedAt = 0;
let version = 0;
let frame = 0;
let reduceMotion = false;
const listeners = new Set<() => void>();
const notify = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};

AccessibilityInfo.isReduceMotionEnabled()
  .then((enabled) => { reduceMotion = enabled; })
  .catch(() => undefined);
AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => { reduceMotion = enabled; });

export const pinBurst = {
  arm() {
    if (reduceMotion) return;
    cancelAnimationFrame(frame);
    phase = 'armed';
    notify();
  },
  run() {
    if (phase !== 'armed') return;
    phase = 'running';
    startedAt = Date.now();
    const tick = () => {
      if (phase !== 'running') return;
      if (Date.now() - startedAt >= PIN_BURST_TOTAL_MS) phase = 'idle';
      else frame = requestAnimationFrame(tick);
      notify();
    };
    frame = requestAnimationFrame(tick);
    notify();
  },
  reset() {
    if (phase === 'idle') return;
    cancelAnimationFrame(frame);
    phase = 'idle';
    notify();
  },
  isArmed: () => phase === 'armed',
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const snapshot = () => version;
const elapsed = () => (phase === 'running' ? Date.now() - startedAt : 0);

/** Marker d'artiste : part de la pastille de son groupe quand il en sort. */
export function BurstMarkerView({
  id,
  coordinate,
  origin,
  children,
}: {
  id: string;
  coordinate: [number, number];
  origin?: BurstOrigin;
  children: ReactElement;
}) {
  useSyncExternalStore(subscribe, snapshot);
  const animated = origin && phase !== 'idle';
  const step = animated ? burstFrame(elapsed(), origin.index) : null;
  return (
    <Mapbox.MarkerView
      id={id}
      coordinate={step && origin ? lerpCoordinate(origin.from, coordinate, step.travel) : coordinate}
      allowOverlap
    >
      {/* Enveloppe toujours présente : la retirer en fin d'animation
          remonterait le pin (et rechargerait sa photo). */}
      <View style={step ? { opacity: step.opacity, transform: [{ scale: step.scale }] } : undefined}>
        {children}
      </View>
    </Mapbox.MarkerView>
  );
}

/** Pastille « N » laissée au-dessus des pins le temps qu'ils en sortent. */
export function BurstClusterGhost({
  id,
  coordinate,
  children,
}: {
  id: string;
  coordinate: [number, number];
  children: ReactElement;
}) {
  useSyncExternalStore(subscribe, snapshot);
  if (phase === 'idle') return null;
  const fade = burstClusterFrame(elapsed());
  if (fade.done) return null;
  return (
    <Mapbox.MarkerView id={id} coordinate={coordinate} allowOverlap>
      <View pointerEvents="none" style={{ opacity: fade.opacity, transform: [{ scale: fade.scale }] }}>
        {children}
      </View>
    </Mapbox.MarkerView>
  );
}

/** Arrête l'horloge si l'écran de la carte est démonté pendant un éclatement. */
export function usePinBurstCleanup() {
  useEffect(() => () => pinBurst.reset(), []);
}
