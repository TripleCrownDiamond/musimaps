#!/usr/bin/env node
/**
 * Garde-fou de conformité design côté mobile.
 *
 *   node scripts/check-design.mjs           # rapport + code 1 si regression
 *   node scripts/check-design.mjs --report  # rapport seul, code 0
 *
 * Le web est protégé par construction : ses classes Tailwind résolvent vers
 * les variables générées depuis `tokens.ts`. Le mobile écrit ses styles en
 * `StyleSheet`, donc rien ne l'empêche de coder une couleur en dur — c'est
 * ainsi qu'on en a compté 91 et 38 rayons distincts (voir docs/AUDIT-DESIGN.md).
 *
 * Ce script fixe un PLAFOND qui ne doit que descendre. Il n'interdit pas
 * d'un coup ce qui existe : il empêche d'en ajouter.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { radii, spacing } from '../packages/shared/src/design/tokens.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE = path.join(ROOT, 'apps/mobile/src');

/**
 * Plafonds actuels. À BAISSER au fil des migrations, jamais à remonter.
 * Une valeur dépassée fait échouer le script.
 */
const BUDGET = {
  hardcodedColors: 32,
  radiusValues: 29,
  spacingValues: 35,
};

/**
 * Fichiers exemptés : la carte manipule des halos et des dégradés dont les
 * valeurs n'ont pas d'équivalent en token, et le socle définit les primitives.
 */
const EXEMPT = [path.join(MOBILE, 'ui'), path.join(MOBILE, 'theme.ts')];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const files = walk(MOBILE).filter((f) => !EXEMPT.some((e) => f.startsWith(e)));

const COLOR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/g;
const RADIUS_RE = /borderRadius:\s*(\d+(?:\.\d+)?)/g;
const PADDING_RE = /padding[A-Za-z]*:\s*(\d+(?:\.\d+)?)/g;

const colorHits = [];
const radiusValues = new Set();
const spacingValues = new Set();

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  for (const line of source.split(/\r?\n/)) {
    // Les commentaires expliquent souvent une couleur : ils ne comptent pas.
    const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    if (COLOR_RE.test(code)) colorHits.push(`${path.relative(ROOT, file)}`);
    COLOR_RE.lastIndex = 0;
  }
  for (const m of source.matchAll(RADIUS_RE)) radiusValues.add(Number(m[1]));
  for (const m of source.matchAll(PADDING_RE)) spacingValues.add(Number(m[1]));
}

const knownRadii = new Set(Object.values(radii));
const knownSpacing = new Set(Object.values(spacing));
const offRadii = [...radiusValues].filter((v) => !knownRadii.has(v)).sort((a, b) => a - b);
const offSpacing = [...spacingValues].filter((v) => !knownSpacing.has(v)).sort((a, b) => a - b);

const current = {
  hardcodedColors: colorHits.length,
  radiusValues: radiusValues.size,
  spacingValues: spacingValues.size,
};

console.log('Conformité design — apps/mobile/src\n');
const rows = [
  ['Couleurs en dur', current.hardcodedColors, BUDGET.hardcodedColors],
  ['Rayons distincts', current.radiusValues, BUDGET.radiusValues],
  ['Espacements distincts', current.spacingValues, BUDGET.spacingValues],
];
let failed = false;
for (const [label, value, budget] of rows) {
  const status = value > budget ? 'DEPASSE' : value < budget ? 'en baisse' : 'stable';
  if (value > budget) failed = true;
  console.log(`  ${label.padEnd(24)} ${String(value).padStart(4)} / ${budget}   ${status}`);
}

if (offRadii.length > 0) {
  console.log(`\n  Rayons hors échelle radii : ${offRadii.join(', ')}`);
}
if (offSpacing.length > 0) {
  console.log(`  Espacements hors échelle spacing : ${offSpacing.slice(0, 20).join(', ')}${offSpacing.length > 20 ? '…' : ''}`);
}

if (failed) {
  console.error(
    '\nUn plafond est dépassé : du style en dur a été ajouté. Utiliser les\n' +
      "primitives de apps/mobile/src/ui et les échelles des tokens partagés.",
  );
  process.exit(1);
}

if (process.argv.includes('--report')) process.exit(0);
console.log('\nAucune régression.');
