/**
 * Garde-fou i18n — echoue si les catalogues partages derivent.
 *
 *   node scripts/check-i18n.mjs
 *
 * Verifie :
 *   1. `fr` et `en` ont exactement le meme jeu de cles.
 *   2. Aucune valeur vide.
 *   3. Les placeholders {nom} sont les memes en fr et en en.
 *   4. Aucun tutoiement en francais (voix de marque : vouvoiement partout).
 *   5. Toute cle litterale `t('...')` des deux apps existe dans le catalogue.
 *
 * Voir docs/REGLES-EVOLUTION.md.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');

const { fr } = await import(`file:///${join(ROOT, 'packages/shared/src/i18n/fr.ts').split('\\').join('/')}`);
const { en } = await import(`file:///${join(ROOT, 'packages/shared/src/i18n/en.ts').split('\\').join('/')}`);

const errors = [];

// 1. Meme jeu de cles.
const frKeys = new Set(Object.keys(fr));
const enKeys = new Set(Object.keys(en));
for (const k of frKeys) if (!enKeys.has(k)) errors.push(`cle sans traduction EN : ${k}`);
for (const k of enKeys) if (!frKeys.has(k)) errors.push(`cle EN sans source FR : ${k}`);

// 2. Valeurs non vides.
for (const [lang, cat] of [['fr', fr], ['en', en]]) {
  for (const [k, v] of Object.entries(cat)) {
    if (typeof v !== 'string' || v.trim() === '') errors.push(`valeur vide : [${lang}] ${k}`);
  }
}

// 3. Placeholders coherents — on compare les NOMS utilises, pas leur nombre :
// le francais accorde nom ET adjectif (« artiste{s} possible{s} ») la ou
// l'anglais n'a qu'un marqueur (« artist{s} available »).
const holders = (s) => [...new Set(s.match(/\{(\w+)\}/g) ?? [])].sort().join(',');
for (const k of frKeys) {
  if (!enKeys.has(k)) continue;
  if (holders(fr[k]) !== holders(en[k])) {
    errors.push(`placeholders differents : ${k}\n    fr : ${holders(fr[k]) || '(aucun)'}\n    en : ${holders(en[k]) || '(aucun)'}`);
  }
}

// 4. Vouvoiement. Bordure Unicode : \b est ASCII et « etes » ferait un faux positif.
const TU = /(?<![\p{L}])(tu|ton|ta|tes|toi)(?![\p{L}])/iu;
for (const [k, v] of Object.entries(fr)) {
  if (TU.test(v)) errors.push(`tutoiement (la voix est le vouvoiement) : ${k} — « ${v} »`);
}

// 5. Cles litterales referencees par les apps.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

// L'admin est une surface web-only assumee, avec son propre catalogue
// (apps/web/src/admin/i18n.ts) : il n'entre pas dans le contrat partage.
const ADMIN = join(ROOT, 'apps/web/src/admin');
const files = [
  ...walk(join(ROOT, 'apps/web/src')).filter((f) => !f.startsWith(ADMIN)),
  ...walk(join(ROOT, 'apps/mobile/src')),
];
const used = new Map();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.-]+)'/g)) {
    if (!used.has(m[1])) used.set(m[1], f);
  }
}
for (const [k, f] of used) {
  if (!frKeys.has(k)) {
    errors.push(`cle inexistante utilisee : '${k}' dans ${f.replace(ROOT, '.')}`);
  }
}

// --- rapport ---
if (errors.length) {
  console.error(`i18n : ${errors.length} probleme(s)\n`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(
  `i18n OK — ${frKeys.size} cles, fr/en synchrones, ${used.size} cles referencees resolues`,
);
