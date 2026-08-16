/**
 * Le déplacement d'un pin par un administrateur applique le DÉPLACEMENT à la
 * coordonnée brute — il n'enregistre pas le point de dépôt.
 *
 * Sans cette distinction, l'artiste encaisse le décalage de spirale de
 * `declump` à chaque sauvegarde, et dérive un peu plus à chaque fois.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ADMIN_COORD_DECIMALS,
  movedCoordinates,
} from '../packages/shared/src/map/admin-move.ts';

test('un pin non dés-empilé se déplace exactement là où on le dépose', () => {
  const raw = [8.533, 11.972]; // Kano, Nigeria
  // Pin seul dans son groupe : position affichée = coordonnée brute.
  const next = movedCoordinates(raw, raw, [8.6, 12.05]);
  assert.deepEqual(next, [8.6, 12.05]);
});

test("le décalage de spirale n'est pas enregistré comme position", () => {
  const raw = [2.3522, 48.8566]; // Paris
  // L'artiste partage son point avec d'autres : declump l'écarte de ~0,02°.
  const rendered = [2.3722, 48.8666];
  // L'admin le dépose 0,01° plus à l'est : c'est CE déplacement qui compte.
  const next = movedCoordinates(raw, rendered, [2.3822, 48.8666]);

  assert.deepEqual(next, [2.362, 48.857]);
  // Le piège : enregistrer le point de dépôt aurait téléporté l'artiste de
  // 0,02° vers le nord-est sans que personne ne l'ait demandé.
  assert.notDeepEqual(next, [2.3822, 48.8666]);
});

test('la coordonnée est arrondie à la grille de vie privée', () => {
  const raw = [2.35224681, 48.85661234];
  const next = movedCoordinates(raw, raw, [2.35224681, 48.85661234]);
  for (const value of next) {
    const decimals = (String(value).split('.')[1] ?? '').length;
    assert.ok(
      decimals <= ADMIN_COORD_DECIMALS,
      `${value} porte ${decimals} décimales, plus que les ${ADMIN_COORD_DECIMALS} autorisées`,
    );
  }
});

test('une correction intercontinentale est permise', () => {
  // Not Zany : déclaré à Kano (NG), pin posé à Kagoshima (JP), 13 034 km.
  const raw = [130.558, 31.596];
  const next = movedCoordinates(raw, raw, [8.533, 11.972]);
  assert.deepEqual(next, [8.533, 11.972]);
});

test('la latitude reste dans les bornes de Mercator', () => {
  const raw = [0, 84];
  const next = movedCoordinates(raw, raw, [0, 89]);
  assert.equal(next[1], 85);
});

test("la longitude s'enroule au lieu de sortir de la carte", () => {
  const raw = [179, 0];
  const next = movedCoordinates(raw, raw, [183, 0]);
  assert.equal(next[0], -177);
});
