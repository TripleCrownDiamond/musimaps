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
const webExploreSource = readFileSync(
  new URL('../apps/web/src/pages/GlobeExplore.tsx', import.meta.url),
  'utf8',
);
const webPinCss = readFileSync(
  new URL('../apps/web/src/index.css', import.meta.url),
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

test('la rotation native utilise le déplacement Mapbox direct, sans réinjecter un centre périmé', () => {
  assert.match(source, /cameraRef\.current\?\.moveBy\(/);
  assert.match(source, /spinPixelsFor\(mapZoom, duration\)/);
  assert.match(source, /Platform\.OS !== 'web'/);
});

test('l’interaction mobile ne désactive pas le mode rotation', () => {
  // Le drag/pinch doit seulement donner la priorité à Mapbox pendant le
  // geste. L’état Play/Pause reste inchangé et la rotation reprend ensuite.
  assert.match(source, /gestureActiveRef = useRef\(false\)/);
  assert.match(source, /if \(gestureActiveRef\.current\) return/);
  assert.match(source, /if \(gestures\?\.isGestureActive\) gestureActiveRef\.current = true/);
  assert.match(source, /onMapIdle=\{\(event\) => \{\s*gestureActiveRef\.current = false;/);
  assert.doesNotMatch(source, /gestures\?\.isGestureActive && spinRef\.current/);
  assert.doesNotMatch(source, /setSpinning\(false\)/);

  const mapPressStart = source.indexOf('onPress={() => {', source.indexOf('<Mapbox.MapView'));
  const mapPressEnd = source.indexOf('}}', mapPressStart);
  assert.ok(mapPressStart !== -1 && mapPressEnd !== -1, 'callback onPress de la carte introuvable');
  assert.doesNotMatch(source.slice(mapPressStart, mapPressEnd), /setSpinning\(false\)/);
});

test('l’adaptateur Expo Web ne laisse pas réapparaître le branding Mapbox', () => {
  assert.match(source, /musimaps-mapbox-branding/);
  assert.match(source, /mapboxgl-ctrl-logo/);
  assert.match(source, /mapboxgl-ctrl-attrib/);
  assert.match(source, /document\.createElement\('style'\)/);
});

test('la recherche reste en bas, garde la searchbox fixe et trie les résultats', () => {
  assert.match(source, /searchPanel: \{[^}]*justifyContent: 'flex-end'/);
  assert.match(source, /sheet: \{\s*height: '62%',/);
  assert.doesNotMatch(source, /resultsScrollTop/);
  assert.match(source, /style=\{styles\.resultsScroll\}/);
  assert.match(source, /outputRange: \[28, 0\]/);
  assert.match(source, /input:focus/);
  assert.match(webExploreSource, /absolute inset-0 z-40 flex flex-col justify-end bg-black\/20 backdrop-blur-sm/);
  assert.doesNotMatch(webExploreSource, /search-results-top/);
  assert.match(webExploreSource, /sheet-in relative z-10 mx-auto h-\[62vh\] w-full max-w-2xl rounded-t/);
  assert.match(webExploreSource, /rankSearchResults\(/);
  assert.match(source, /rankSearchResults\(/);
});

test('les étincelles pays/ville restent visibles au dézoom', () => {
  // La pointe des pins artistes est masquée au loin, mais cette règle ne doit
  // jamais viser les pseudo-éléments des clusters : ils portent le seul point
  // lumineux de la vue globe. Un conflit de spécificité les avait fait
  // disparaître sur le web.
  assert.match(
    webPinCss,
    /\.map-zoom-far \.artist-pin:not\(\.artist-pin--cluster\):not\(\.artist-pin--sub\):not\(\.artist-pin--preview-cluster\)::after/,
  );
  assert.match(webPinCss, /\.map-zoom-far \.artist-pin--cluster::after/);
  assert.match(source, /shadowRadius: mapUi\.clusterDotGlowRadius/);
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
