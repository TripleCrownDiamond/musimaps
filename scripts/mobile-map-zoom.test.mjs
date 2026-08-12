import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../apps/mobile/src/screens/ExploreScreen.tsx', import.meta.url),
  'utf8',
);

test('le zoom mobile provient uniquement des événements caméra Mapbox v10', () => {
  assert.doesNotMatch(source, /flyAnimRef|mapZoomRef/);
  assert.doesNotMatch(source, /onRegionIsChanging/);
  assert.match(source, /onCameraChanged=/);
  assert.equal(source.match(/setMapZoom\(/g)?.length, 1);
});
