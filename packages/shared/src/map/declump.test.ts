/**
 * Stabilité des positions de pins au zoom.
 *
 * Symptôme signalé : « en zoomant, les pins se déplacent ». Deux causes
 * possibles, toutes deux réelles dans le code, toutes deux couvertes ici :
 *
 *  1. recalculer `declump` avec le zoom courant → les pins glissent à chaque
 *     frame d'un pinch ;
 *  2. calculer la cible de la caméra à un zoom différent de celui du rendu →
 *     on centre l'écran sur un point où il n'y a pas de pin.
 *
 * `PIN_LAYOUT_ZOOM` est la réponse aux deux : une seule valeur, pour le rendu
 * comme pour la caméra, sur les deux plateformes.
 */
import { describe, expect, it } from 'vitest';
import type { Artist } from '../index';
import {
  CAMERA,
  PIN_LAYOUT_ZOOM,
  TIER_RING_WIDTH,
  isGlobeView,
  declump,
  firstRenderedPosition,
  pinRingWidthFor,
  renderedPosition,
  levelFor,
  spinPixelsFor,
} from './index';

/** Artiste minimal posé sur une coordonnée donnée. */
const at = (id: string, name: string, coordinates: [number, number]): Artist => ({
  id,
  name,
  genre: 'Rap',
  city: 'Paris',
  country: 'France',
  flag: '🇫🇷',
  coordinates,
  bio: '',
  followers: '',
  color: ['#000000', '#ffffff'],
  tracks: [],
  events: [],
});

/** Trois artistes exactement au même point : le cas que `declump` doit écarter. */
const STACKED: Artist[] = [
  at('a', 'Alpha', [2.3522, 48.8566]),
  at('b', 'Bravo', [2.3522, 48.8566]),
  at('c', 'Charlie', [2.3522, 48.8566]),
];

describe('PIN_LAYOUT_ZOOM', () => {
  it('est une valeur unique et exploitable', () => {
    expect(Number.isFinite(PIN_LAYOUT_ZOOM)).toBe(true);
    expect(PIN_LAYOUT_ZOOM).toBeGreaterThan(0);
  });
});

describe('anneaux de popularité', () => {
  it('augmente l\'épaisseur avec chaque niveau pour rester lisible', () => {
    expect(TIER_RING_WIDTH[0]).toBeLessThan(TIER_RING_WIDTH[1]);
    expect(TIER_RING_WIDTH[1]).toBeLessThan(TIER_RING_WIDTH[2]);
    expect(TIER_RING_WIDTH[2]).toBeLessThan(TIER_RING_WIDTH[3]);
    expect(pinRingWidthFor(3)).toBe(TIER_RING_WIDTH[3]);
  });
});

describe('rotation native', () => {
  it('convertit une durée de rotation en déplacement pixel positif', () => {
    expect(spinPixelsFor(0.75, 250)).toBeGreaterThan(0);
    expect(spinPixelsFor(6, 250)).toBeGreaterThan(spinPixelsFor(0.75, 250));
  });
});

describe('rotation réservée à la vue globe', () => {
  it('autorise Play uniquement avant le détail pays', () => {
    expect(isGlobeView(CAMERA.globe.zoom)).toBe(true);
    expect(isGlobeView(3.19)).toBe(true);
    for (const zoom of [3.2, CAMERA.country.zoom, CAMERA.city.zoom, CAMERA.artist.zoom]) {
      expect(isGlobeView(zoom)).toBe(false);
    }
  });

  it('le recentrage révèle les pins de quartier et interdit la rotation', () => {
    expect(levelFor(CAMERA.location.zoom)).toBe('spread');
    expect(isGlobeView(CAMERA.location.zoom)).toBe(false);
  });

  it('n’autorise pas la rotation à partir d’un zoom invalide', () => {
    for (const zoom of [NaN, Infinity, -Infinity]) expect(isGlobeView(zoom)).toBe(false);
  });
});

describe('declump', () => {
  it('écarte des artistes superposés', () => {
    const spread = declump(STACKED, PIN_LAYOUT_ZOOM);
    const positions = STACKED.map((a) => spread.get(a.id)!.join(','));
    expect(new Set(positions).size).toBe(3);
  });

  it('laisse un artiste seul sur sa vraie coordonnée', () => {
    const alone = [at('x', 'Xray', [2.3522, 48.8566])];
    expect(declump(alone, PIN_LAYOUT_ZOOM).get('x')).toEqual([2.3522, 48.8566]);
  });

  it('est déterministe — deux appels identiques rendent la même chose', () => {
    const a = declump(STACKED, PIN_LAYOUT_ZOOM);
    const b = declump(STACKED, PIN_LAYOUT_ZOOM);
    for (const artist of STACKED) expect(a.get(artist.id)).toEqual(b.get(artist.id));
  });

  it('ne dépend pas de l’ordre d’entrée', () => {
    const direct = declump(STACKED, PIN_LAYOUT_ZOOM);
    const reversed = declump([...STACKED].reverse(), PIN_LAYOUT_ZOOM);
    for (const artist of STACKED) {
      expect(reversed.get(artist.id)).toEqual(direct.get(artist.id));
    }
  });

  it('DÉPLACE les pins si on change le zoom — d’où la constante partagée', () => {
    // Test de caractérisation : il documente exactement le bug. Passer le zoom
    // courant plutôt que `PIN_LAYOUT_ZOOM` fait bouger les positions.
    const atLayout = declump(STACKED, PIN_LAYOUT_ZOOM);
    const atOther = declump(STACKED, PIN_LAYOUT_ZOOM + 2);
    expect(atOther.get('b')).not.toEqual(atLayout.get('b'));
  });

  it('sépare chaque pin d’un amas dense sans dépasser le plafond de véracité', () => {
    // Une scène entière (Cotonou ~72 artistes) partage la coordonnée de SA
    // ville : la spirale standard sature le plafond de 1,5 km et re-empile.
    // Séparation resserrée → positions distinctes MÊME au plafond.
    const dense = Array.from({ length: 72 }, (_, i) =>
      at(`d${i}`, `Artist ${String(i).padStart(2, '0')}`, [2.43, 6.37]),
    );
    const spread = declump(dense, PIN_LAYOUT_ZOOM);
    const positions = new Set(dense.map((a) => spread.get(a.id)!.join(',')));
    expect(positions.size).toBe(dense.length);
  });

  it('ancre chaque quartier sur sa vraie position (champ district)', () => {
    // Vèdoko et Ganhi sont deux quartiers réels de Cotonou : leurs pins ne
    // doivent pas tourner ensemble autour du même barycentre.
    const vedoko = at('v1', 'Alpha', [2.42, 6.37]);
    vedoko.district = 'Vèdoko';
    const ganhi = at('g1', 'Bravo', [2.43, 6.36]);
    ganhi.district = 'Ganhi';
    const spread = declump([vedoko, ganhi], PIN_LAYOUT_ZOOM);
    // Quartiers distincts → ancres distinctes (pas de barycentre commun).
    expect(spread.get('v1')).not.toEqual(spread.get('g1'));
    expect(spread.get('v1')![0]).toBeLessThan(spread.get('g1')![0]);
  });

  it('répartit aussi des quartiers grossièrement au même point', () => {
    // Données imprécises : deux quartiers géocodés au même endroit.
    const a = at('qa', 'Alpha', [2.43, 6.37]);
    a.district = 'Vèdoko';
    const b = at('qb', 'Bravo', [2.43, 6.37]);
    b.district = 'Ganhi';
    const c = at('qc', 'Charlie', [2.43, 6.37]);
    c.district = 'Vèdoko';
    const spread = declump([a, b, c], PIN_LAYOUT_ZOOM);
    const v1 = spread.get('qa')!;
    const v2 = spread.get('qc')!;
    const g = spread.get('qb')!;
    expect(new Set([v1.join(','), v2.join(','), g.join(',')]).size).toBe(3);
    // Les deux Vèdoko tournent autour de la MÊME ancre.
    const center = [
      (v1[0] + v2[0]) / 2,
      (v1[1] + v2[1]) / 2,
    ];
    expect(Math.hypot(center[0] - 2.43, center[1] - 6.37)).toBeLessThan(0.05);
  });
});

describe('cohérence rendu ↔ caméra', () => {
  it('renderedPosition vise exactement la position dessinée', () => {
    // L'invariant qui manquait : le mobile calculait la cible du vol aux zooms
    // 12 ou 14 alors que les pins sont dessinés à `PIN_LAYOUT_ZOOM`.
    const drawn = declump(STACKED, PIN_LAYOUT_ZOOM);
    for (const artist of STACKED) {
      expect(renderedPosition(STACKED, artist.id, PIN_LAYOUT_ZOOM)).toEqual(drawn.get(artist.id));
    }
  });

  it('firstRenderedPosition vise le premier pin dessiné', () => {
    const first = firstRenderedPosition(STACKED, PIN_LAYOUT_ZOOM);
    expect(first?.id).toBe('a');
    expect(first?.coordinates).toEqual(declump(STACKED, PIN_LAYOUT_ZOOM).get('a'));
  });

  it('rend undefined pour un artiste inconnu ou sans coordonnées', () => {
    expect(renderedPosition(STACKED, 'inconnu', PIN_LAYOUT_ZOOM)).toBeUndefined();
    const broken = [at('z', 'Zulu', [Number.NaN, Number.NaN])];
    expect(renderedPosition(broken, 'z', PIN_LAYOUT_ZOOM)).toBeUndefined();
    expect(firstRenderedPosition(broken, PIN_LAYOUT_ZOOM)).toBeUndefined();
  });
});
