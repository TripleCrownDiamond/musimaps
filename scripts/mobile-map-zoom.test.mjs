import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../apps/mobile/src/screens/ExploreScreen.tsx', import.meta.url),
  'utf8',
);
const webMapSource = readFileSync(
  new URL('../apps/web/src/components/GlobeMap.tsx', import.meta.url),
  'utf8',
);
const authSource = readFileSync(
  new URL('../packages/shared/src/lib/auth.ts', import.meta.url),
  'utf8',
);

test('le zoom mobile provient uniquement des événements caméra Mapbox v10', () => {
  assert.doesNotMatch(source, /flyAnimRef|mapZoomRef/);
  assert.doesNotMatch(source, /onRegionIsChanging/);
  assert.match(source, /onCameraChanged=/);
  assert.equal(source.match(/setMapZoom\(/g)?.length, 1);
});

test('Expo Web raccorde explicitement les événements Mapbox GL ignorés par l’adaptateur RN', () => {
  assert.match(source, /Platform\.OS === 'web'/);
  assert.match(source, /webMap\.on\('zoom'/);
  assert.match(source, /webMap\.on\('moveend'/);
});

test('le dézoom reclustre toujours le catalogue complet, sans filtre de viewport périmé', () => {
  assert.match(source, /base = allArtists;/);
  assert.doesNotMatch(source, /base = regionArtists;/);
});

test('les petits clusters pays restent touchables et n’envoient pas le geste à la carte', () => {
  assert.match(source, /stopGesturePropagation/);
  assert.match(source, /hitSlop=\{mapUi\.clusterHitSlop\}/);
  assert.match(source, /clusterPulse\.interpolate/);
});

test('les pins artistes gardent des coordonnées stables pendant le zoom sur mobile et web', () => {
  // Le rendu passe par la constante partagée, jamais par le zoom courant :
  // recalculer la spirale à chaque frame ferait glisser les pins pendant un pinch.
  assert.match(source, /declump\(valid, PIN_LAYOUT_ZOOM\)/);
  assert.doesNotMatch(source, /declump\(valid, mapZoom\)/);
  assert.match(webMapSource, /declump\(allArtists, PIN_LAYOUT_ZOOM\)/);
  assert.doesNotMatch(webMapSource, /declump\(allArtists, liveZoom\)/);
});

test('le zoom web ne reconstruit pas tous les markers à chaque frame', () => {
  // La reconstruction complète des DOM markers pendant `zoom` provoquait
  // des ralentissements visibles avec un catalogue dense. Le halo est
  // désormais mis à jour par variables CSS, sans état React intermédiaire.
  assert.doesNotMatch(webMapSource, /liveZoom|setLiveZoom/);
  assert.match(webMapSource, /markersRef\.current\.forEach\(\(marker\) =>/);
  assert.doesNotMatch(webMapSource, /\}, \[[^\]]*liveZoom/);
});

test('la caméra vise la position DESSINÉE, jamais une position calculée au zoom de destination', () => {
  // Le mobile calculait ses cibles de vol à 12, 13 ou 14 selon le contexte,
  // alors que les pins sont toujours dessinés à PIN_LAYOUT_ZOOM : la caméra
  // se centrait sur un point où il n'y avait pas de pin.
  for (const file of [source, webMapSource]) {
    assert.doesNotMatch(file, /declump\([^)]*,\s*1[0-9](\.[0-9]+)?\s*\)/);
    assert.doesNotMatch(file, /renderedPosition\([^)]*,\s*1[0-9](\.[0-9]+)?\s*\)/);
    assert.doesNotMatch(file, /firstRenderedPosition\([^)]*,\s*1[0-9](\.[0-9]+)?\s*\)/);
  }
  // Le web ne doit pas réutiliser le zoom de la caméra pour positionner.
  assert.doesNotMatch(webMapSource, /firstRenderedPosition\(artists, zoom\)/);
});

test('les contournements DOM du web ne s’exécutent jamais en natif', () => {
  // `getScrollableNode()` passe par `findNodeHandle`, déprécié et qui LÈVE
  // sous la Nouvelle Architecture (défaut depuis le SDK 57). Appelé depuis un
  // `onPress` sans capture, il fermait l'app en production — au clic sur
  // « suivant » de l'onboarding, jamais au swipe.
  const onboarding = readFileSync(
    new URL('../apps/mobile/src/screens/OnboardingScreen.tsx', import.meta.url),
    'utf8',
  );
  const guardIndex = onboarding.indexOf("Platform.OS === 'web'");
  const usageIndex = onboarding.indexOf('getScrollableNode?.()');
  assert.ok(guardIndex !== -1, 'le contournement doit être gardé par Platform.OS');
  assert.ok(
    usageIndex > guardIndex,
    'getScrollableNode ne doit être atteignable qu’APRÈS le garde web',
  );
});

test('aucune trace de debug ne subsiste dans l’écran carte mobile', () => {
  // Deux de ces journaux tournaient à chaque recalcul de pins, donc à chaque
  // frame d'un pinch : sur React Native, console.log traverse le pont Metro.
  assert.doesNotMatch(source, /console\.log/);
});

test('une session Supabase valide ne redevient pas anonyme si le profil arrive en retard', () => {
  assert.match(authSource, /fetchProfile\(data\.user\.id, data\.user\.email \?\? null\) \?\? sessionShell\(data\.user\)/);
  assert.match(authSource, /resendSignUpConfirmation/);
  assert.match(authSource, /emailRedirectTo: getSignUpConfirmationUrl\(\)/);
});
