import assert from 'node:assert/strict';
import test from 'node:test';

import { planGeoRepair } from './lib/geo-repair.mjs';

test('Not Zany: un aberrant conserve NG et déplace seulement ses coordonnées', () => {
  assert.deepEqual(
    planGeoRepair({
      declaredCountry: 'NG',
      reverseCountry: 'JP',
      isOutlier: true,
      forwardDeclared: { country: 'NG', coords: [8.533296, 11.972123] },
      forwardReverse: null,
    }),
    { kind: 'coordinates', coords: [8.533296, 11.972123] },
  );
});

test('un aberrant sans cible fiable est refusé au lieu de changer de pays', () => {
  assert.deepEqual(
    planGeoRepair({
      declaredCountry: 'NG',
      reverseCountry: 'JP',
      isOutlier: true,
      forwardDeclared: null,
      forwardReverse: null,
    }),
    { kind: 'refuse', reason: 'outlier-without-safe-target' },
  );
});

test('Dalida: coordonnées au Caire et ville Égypte réalignent seulement le pays', () => {
  assert.deepEqual(
    planGeoRepair({
      declaredCountry: 'FR',
      reverseCountry: 'EG',
      isOutlier: false,
      forwardDeclared: null,
      forwardReverse: { country: 'EG', coords: [31.241106, 30.047558] },
    }),
    { kind: 'country', country: 'EG' },
  );
});

test('Apashe: le pin à Brussels est validé en Belgique, jamais déplacé en Ontario', () => {
  assert.deepEqual(
    planGeoRepair({
      declaredCountry: 'CA',
      reverseCountry: 'BE',
      isOutlier: false,
      forwardDeclared: null,
      forwardReverse: { country: 'BE', coords: [4.3517, 50.8503] },
    }),
    { kind: 'country', country: 'BE' },
  );
});

test('un petit groupe ambigu reste intact', () => {
  assert.deepEqual(
    planGeoRepair({
      declaredCountry: 'FR',
      reverseCountry: 'CA',
      isOutlier: false,
      forwardDeclared: null,
      forwardReverse: null,
    }),
    { kind: 'refuse', reason: 'country-evidence-conflict' },
  );
});
