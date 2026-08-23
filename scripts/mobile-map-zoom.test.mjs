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
  assert.match(source, /hitSlop=\{18\}/);
});

test('les pins artistes gardent des coordonnées stables pendant le zoom sur mobile et web', () => {
  assert.match(source, /declump\(valid, CAMERA\.artist\.zoom\)/);
  assert.doesNotMatch(source, /declump\(valid, mapZoom\)/);
  assert.match(webMapSource, /declump\(allArtists, CAMERA\.artist\.zoom\)/);
  assert.doesNotMatch(webMapSource, /declump\(allArtists, liveZoom\)/);
});

test('une session Supabase valide ne redevient pas anonyme si le profil arrive en retard', () => {
  assert.match(authSource, /fetchProfile\(data\.user\.id, data\.user\.email \?\? null\) \?\? sessionShell\(data\.user\)/);
  assert.match(authSource, /resendSignUpConfirmation/);
  assert.match(authSource, /emailRedirectTo: getSignUpConfirmationUrl\(\)/);
});
