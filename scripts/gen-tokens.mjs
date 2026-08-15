/**
 * Génère `apps/web/src/tokens.generated.css` depuis la source unique
 * `packages/shared/src/design/tokens.ts`.
 *
 *   node scripts/gen-tokens.mjs           # écrit le fichier
 *   node scripts/gen-tokens.mjs --check   # échoue si le fichier est périmé
 *
 * Le mode --check est le garde-fou : il détecte qu'on a édité le CSS généré
 * à la main, ou modifié les tokens sans régénérer. Voir docs/REGLES-EVOLUTION.md.
 *
 * Node 22.18+/24 lit directement le .ts (type stripping natif).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { lightPalette, darkPalette, mapOverlays, mapUi, typography } from '../packages/shared/src/design/tokens.ts';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../apps/web/src/tokens.generated.css');

/**
 * Tokens exposés au web, dans l'ordre. Le web n'utilise pas tout le jeu
 * partagé (`danger`, `muted` restent mobile-only pour l'instant) : on
 * n'émet que ce qui existait déjà, pour que le CSS produit soit inchangé.
 */
const THEME_KEYS = [
  ['--color-warm-white', 'warmWhite'],
  ['--color-secondary-bg', 'secondaryBg'],
  ['--color-primary-text', 'primaryText'],
  ['--color-secondary-text', 'secondaryText'],
  // Noms semantiques — a privilegier dans tout code nouveau.
  ['--color-brand-primary', 'brandPrimary'],
  ['--color-brand-secondary', 'brandSecondary'],
  // Noms historiques, conserves : ~600 sites d'appel en dependent.
  ['--color-brand', 'brand'],
  ['--color-brand-deep', 'brandDeep'],
  ['--color-brand-deep-foreground', 'brandDeepForeground'],
  ['--color-brand-soft', 'brandSoft'],
  ['--color-accent', 'accent'],
  ['--color-success', 'success'],
  ['--color-surface', 'surface'],
  ['--color-hairline', 'hairline'],
  ['--color-hairline-strong', 'hairlineStrong'],
  ['--color-ink', 'ink'],
  ['--color-ink-foreground', 'inkForeground'],
];

/** Sous-ensemble redéfini en sombre, dans l'ordre du fichier d'origine. */
const DARK_KEYS = [
  ['--color-warm-white', 'warmWhite'],
  ['--color-secondary-bg', 'secondaryBg'],
  ['--color-surface', 'surface'],
  ['--color-primary-text', 'primaryText'],
  ['--color-secondary-text', 'secondaryText'],
  ['--color-brand-deep', 'brandDeep'],
  ['--color-brand-deep-foreground', 'brandDeepForeground'],
  ['--color-brand-soft', 'brandSoft'],
  ['--color-hairline', 'hairline'],
  ['--color-hairline-strong', 'hairlineStrong'],
  ['--color-ink', 'ink'],
  ['--color-ink-foreground', 'inkForeground'],
];

/**
 * Voile des surfaces posées sur la carte. Le web n'en consomme aujourd'hui
 * que l'étiquette de nom d'un pin (`.artist-pin__tooltip`) ; le reste du jeu
 * est mobile-only et n'a pas à encombrer le CSS.
 */
const OVERLAY_KEYS = [
  ['--map-label-surface', 'labelSurface'],
  ['--map-pin-ink', 'pinInk'],
  ['--map-pin-ink-inverse', 'pinInkInverse'],
];

const lines = [
  '/* GÉNÉRÉ — ne pas éditer à la main.',
  ' * Source : packages/shared/src/design/tokens.ts',
  ' * Régénérer : node scripts/gen-tokens.mjs',
  ' */',
  '',
  '@theme {',
  `  --font-display: '${typography.display}', sans-serif;`,
  `  --font-body: '${typography.body}', sans-serif;`,
  ...THEME_KEYS.map(([css, key]) => `  ${css}: ${lightPalette[key]};`),
  '}',
  '',
  ':root {',
  `  --map-pin-diameter: ${mapUi.artistPinDiameter}px;`,
  `  --map-cluster-min-width: ${mapUi.clusterMinWidth}px;`,
  `  --map-cluster-radius: ${mapUi.clusterRadius}px;`,
  `  --map-cluster-padding-x: ${mapUi.clusterPaddingX}px;`,
  `  --map-cluster-padding-y: ${mapUi.clusterPaddingY}px;`,
  `  --map-subcluster-diameter: ${mapUi.subclusterDiameter}px;`,
  ...OVERLAY_KEYS.map(([css, key]) => `  ${css}: ${mapOverlays.light[key]};`),
  '}',
  '',
  ':root[data-theme=\'dark\'] {',
  `  --map-dot: ${darkPalette.mapDot};`,
  ...DARK_KEYS.map(([css, key]) => `  ${css}: ${darkPalette[key]};`),
  '  color-scheme: dark;',
  '}',
  '',
].join('\n');

const check = process.argv.includes('--check');
if (check) {
  let current = '';
  try {
    current = readFileSync(OUT, 'utf8');
  } catch {
    console.error('tokens.generated.css absent — lancer `node scripts/gen-tokens.mjs`');
    process.exit(1);
  }
  if (current.replace(/\r\n/g, '\n') !== lines) {
    console.error(
      'tokens.generated.css est perime par rapport a packages/shared/src/design/tokens.ts.\n' +
        'Lancer `node scripts/gen-tokens.mjs` et committer le resultat.',
    );
    process.exit(1);
  }
  console.log('tokens.generated.css a jour');
} else {
  writeFileSync(OUT, lines, 'utf8');
  console.log(`ecrit ${OUT}`);
}
