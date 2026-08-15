#!/usr/bin/env node
/**
 * Garde-fou de LISIBILITÉ de la carte.
 *
 *   node scripts/check-map-contrast.mjs           # rapport + code 1 si régression
 *   node scripts/check-map-contrast.mjs --report  # rapport seul, code 0
 *
 * Pourquoi ce script existe : la carte claire avait dérivé vers une feuille
 * blanche. Mesuré avant correction — terre/eau **1,20:1** (les côtes
 * n'existaient pas), terre/espace **1,06:1** (le globe n'avait pas de bord) et
 * surtout l'anneau lime du tier 3 à **1,16:1** sur la terre : les artistes les
 * plus populaires, ceux que la carte existe pour montrer, étaient les seuls
 * invisibles.
 *
 * Rien dans le code ne l'empêchait : chaque valeur, prise isolément, est une
 * couleur valide. C'est leur RAPPORT qui casse, et un rapport ne se relit pas
 * dans un diff. D'où un plafond chiffré, comme `check-design.mjs`.
 *
 * Le principe : ces seuils ne doivent que MONTER. Une valeur en dessous fait
 * échouer le script.
 */
import { lightPalette, darkPalette, mapOverlays } from '../packages/shared/src/design/tokens.ts';

/**
 * Anneaux de notoriété. Recopiés depuis `packages/shared/src/index.ts`, qui
 * importe `./geo` sans extension — le type stripping natif de Node refuse de
 * le résoudre. Si les deux divergent, le test de couverture ci-dessous le dit.
 */
const POPULARITY_RING_COLORS = {
  0: '#7C8698',
  1: '#2F52E0',
  2: '#1E3AA8',
  3: '#A8FF35',
};

/**
 * Planchers actuels. À MONTER quand on améliore, jamais à descendre.
 *
 * `darkLandWater` est bas et c'est un constat, pas une cible : le thème
 * sombre a le même défaut de séparation que le clair avant correction. Il est
 * consigné ici pour qu'on ne l'aggrave pas, et reste à traiter.
 */
const FLOOR = {
  lightLandWater: 1.77,
  darkLandWater: 1.36,
  /** Le liseré doit détacher le pin du fond, quel que soit son tier. */
  pinEdge: 3,
  /** Un label de pays doit rester lisible sur la terre. */
  label: 4.5,
};

const srgb = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Accepte `#RGB`, `#RRGGBB` et `rgba(r, g, b, a)`. */
function parse(color) {
  const rgba = color.match(/^rgba?\(([^)]+)\)$/i);
  if (rgba) {
    const parts = rgba[1].split(',').map((v) => Number(v.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }
  const h = color.replace('#', '');
  const n = h.length === 3 ? h.split('').map((x) => x + x).join('') : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  return { r, g, b, a: 1 };
}

/** Compose une couleur translucide sur son fond — sans quoi le liseré ment. */
function flatten(color, background) {
  const f = parse(color);
  if (f.a >= 1) return f;
  const b = parse(background);
  return {
    r: f.r * f.a + b.r * (1 - f.a),
    g: f.g * f.a + b.g * (1 - f.a),
    b: f.b * f.a + b.b * (1 - f.a),
    a: 1,
  };
}

function luminance(c) {
  const [r, g, b] = [c.r, c.g, c.b].map((v) => srgb(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport WCAG, la couleur avant étant aplatie sur le fond si besoin. */
function ratio(foreground, background) {
  const [x, y] = [luminance(flatten(foreground, background)), luminance(parse(background))].sort(
    (p, q) => q - p,
  );
  return (x + 0.05) / (y + 0.05);
}

const rows = [];
let failed = false;

function check(label, value, floor) {
  const ok = value >= floor - 0.005;
  if (!ok) failed = true;
  rows.push([label, value, floor, ok]);
  return ok;
}

for (const [theme, palette] of [
  ['clair', lightPalette],
  ['sombre', darkPalette],
]) {
  const overlay = mapOverlays[theme === 'clair' ? 'light' : 'dark'];
  const land = palette.mapLand;

  check(
    `${theme} · terre / eau`,
    ratio(palette.mapWater, land),
    theme === 'clair' ? FLOOR.lightLandWater : FLOOR.darkLandWater,
  );
  check(`${theme} · label / terre`, ratio(palette.mapLabel, land), FLOOR.label);

  // Un pin se lit soit par son anneau, soit par son liseré de contact. Le
  // lime du tier 3 sur terre claire ne passera JAMAIS seul : c'est le liseré
  // qui le porte, et c'est exactement ce que cette ligne vérifie.
  const casingEdge = ratio(overlay.pinCasing, land);
  for (const [tier, hex] of Object.entries(POPULARITY_RING_COLORS)) {
    check(
      `${theme} · pin tier ${tier} détaché du fond`,
      Math.max(ratio(hex, land), casingEdge),
      FLOOR.pinEdge,
    );
  }
}

console.log('Lisibilité de la carte — packages/shared/src/design/tokens.ts\n');
for (const [label, value, floor, ok] of rows) {
  const verdict = ok ? (value > floor + 0.005 ? 'en hausse' : 'stable') : 'SOUS LE PLANCHER';
  console.log(`  ${label.padEnd(38)} ${value.toFixed(2).padStart(6)}:1  / ${floor}   ${verdict}`);
}

if (failed) {
  console.error(
    '\nUn plancher de contraste est franchi : la carte perd en lisibilité.\n' +
      'Les couleurs sont dans `tokens.ts` (mapLand, mapWater, mapLabel) et le\n' +
      'liseré de pin dans `mapOverlays.pinCasing`. Voir docs/DECISIONS-PRODUIT.md.',
  );
  process.exit(1);
}

if (process.argv.includes('--report')) process.exit(0);
console.log('\nAucune régression.');
