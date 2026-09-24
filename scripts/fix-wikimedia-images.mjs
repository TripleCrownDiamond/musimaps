/**
 * Réparation des images d'artistes non carrées (Wikipédia).
 *
 * Les 273+ artistes BJ/TG/CI posés par la curation portent presque tous une
 * photo Deezer carrée 1000×1000 (vérifiée à l'insertion). Une douzaine ont
 * hérité d'une image Wikipédia fautive :
 *   - mauvais sujet (homonymie : le papillon « Black Dash », le temple
 *     ECK pour Gopal Das, le restaurant Akadi) ;
 *   - panoramique de concert (3840 px) où le recadrage circulaire perd le
 *     sujet ;
 *   - vignette minuscule (256 px) quiPixelise.
 *
 * Ce script audite TOUTE la table (tous pays) et, pour chaque image non
 * Deezer :
 *   1. tente un remplacement par la photo Deezer (même gates de matching
 *      que les populate-*.mjs : normalisation d'accents, vérification HTTP
 *      de l'image) ;
 *   2. sinon, retire l'image si le sujet est manifestement erroné ou si la
 *      source est extrême (ratio > 2:1 / < 1:2, ou petit côté < 300 px) —
 *      l'avatar retombe sur les initiales, plus propre qu'une photo fausse.
 *
 * Usage : node scripts/fix-wikimedia-images.mjs [--dry-run]
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';

const dry = process.argv.includes('--dry-run');

// --- env ---------------------------------------------------------------
const env = {};
for (const file of ['.env', 'apps/web/.env.local']) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  } catch { /* fichier absent */ }
}
const ref = env.VITE_SUPABASE_URL?.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
if (!ref || !env.DATABASE_PASSWORD) {
  console.error('Manquant : DATABASE_PASSWORD / VITE_SUPABASE_URL');
  process.exit(1);
}
const db = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${env.DATABASE_PASSWORD}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
});

// --- helpers -----------------------------------------------------------
const UA = 'MusimapsCuration/1.0 (https://musimaps.com; curation@musimaps.com)';

const strip = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(the|le|la|les|du|de|d'|l'|&|and)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ').trim();

/** Délai anti rate-limit. */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Photo Deezer d'un artiste : parmi les exact-matches du top résultat,
 *  on prend celui avec le PLUS de fans (évite l'homonyme obscur « ABBA 51
 *  fans »), et on exige un plancher de notoriété pour accepter un
 *  remplacement d'une image Wikipédia a priori correcte. */
const MIN_FANS_FOR_REPLACE = 100;

async function deezerImage(name, aliases = []) {
  for (const query of [name, ...aliases]) {
    try {
      const r = await fetch(
        `https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=12`,
        { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) },
      );
      if (!r.ok) continue;
      const { data = [] } = await r.json();
      const candidates = [name, ...aliases].map(strip);
      const exacts = data.filter((a) => candidates.includes(strip(a.name ?? '')));
      const best = exacts.sort((a, b) => (b.nb_fan ?? 0) - (a.nb_fan ?? 0))[0];
      if (!best || (best.nb_fan ?? 0) < MIN_FANS_FOR_REPLACE) continue;
      if (!best.picture_xl && !best.picture_big) continue;
      const url = best.picture_xl || best.picture_big;
      const ir = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-64' }, signal: AbortSignal.timeout(8000) });
      const type = ir.headers.get('content-type') ?? '';
      if ((ir.status === 200 || ir.status === 206) && type.startsWith('image/')) return { url, deezerName: best.name, fans: best.nb_fan };
    } catch { /* réseau : on tente l'alias suivant */ }
    await sleep(250);
  }
  return null;
}

/** Dimensions intrinsèques d'une image (JPEG/PNG) via entête HTTP partielle. */
async function dimensions(url) {
  try {
    const ir = await fetch(url, { headers: { Range: 'bytes=0-3000' }, signal: AbortSignal.timeout(8000) });
    const buf = Buffer.from(await ir.arrayBuffer());
    let d = null;
    for (let i = 2; i < buf.length - 9; i++) {
      if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2)) {
        d = { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        break;
      }
    }
    if (!d && buf.slice(1, 4).toString() === 'PNG') d = { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    return d;
  } catch {
    return null;
  }
}

// Sujets manifestement erronés détectés à l'audit manuel (homonymie
// Wikipédia : espèce, lieu, enseigne — jamais l'artiste).
const WRONG_SUBJECT = [/Euphyes_conspicua/i, /EckTemple/i, /Akadi_\(restaurant\)/i];

// --- main --------------------------------------------------------------
await db.connect();
const { rows } = await db.query(
  `SELECT id, name, country, image FROM map_artists
   WHERE image IS NOT NULL AND image !~* 'dzcdn\\.net'
   ORDER BY country, name`,
);
console.log(`Audit : ${rows.length} artiste(s) avec une image non Deezer.\n`);

let replaced = 0;
let removed = 0;
let kept = 0;

for (const row of rows) {
  // Les URLs Wikipédia encodent parenthèses/accents (%28…) : on décode
  // avant de tester les motifs de sujets erronés.
  let decodedImage = row.image;
  try { decodedImage = decodeURIComponent(row.image); } catch { /* URL déjà lisible */ }
  const wrong = WRONG_SUBJECT.some((re) => re.test(decodedImage));
  const dims = await dimensions(row.image);
  const ratio = dims ? dims.w / dims.h : 1;
  const tiny = dims ? Math.min(dims.w, dims.h) < 300 : false;
  const extreme = ratio > 2 || ratio < 0.5;

  // 1) remplacement Deezer (prioritaire, même si l'image actuelle est acceptable)
  const dz = await deezerImage(row.name);
  if (dz) {
    console.log(`↻ ${row.country} ${row.name} → Deezer « ${dz.deezerName} » (${dz.fans.toLocaleString('fr-FR')} fans)${wrong ? ' [sujet erroné]' : dims ? ` [${dims.w}x${dims.h}]` : ''}`);
    if (!dry) {
      await db.query('UPDATE map_artists SET image = $1 WHERE id = $2', [dz.url, row.id]);
    }
    replaced += 1;
    continue;
  }

  // 2) pas de remplacement : on retire seulement ce qui est injustifiable
  if (wrong || extreme || tiny) {
    const why = wrong ? 'sujet erroné' : tiny ? 'image minuscule' : `ratio extrême ${ratio.toFixed(2)}`;
    console.log(`✗ ${row.country} ${row.name} → image retirée (${why}) — repli initiales`);
    if (!dry) {
      await db.query('UPDATE map_artists SET image = NULL WHERE id = $1', [row.id]);
    }
    removed += 1;
    continue;
  }

  console.log(`= ${row.country} ${row.name} conservée${dims ? ` [${dims.w}x${dims.h}]` : ' [dimensions inconnues]'}`);
  kept += 1;
}

console.log(`\nTerminé${dry ? ' (dry-run)' : ''} : ${replaced} remplacée(s), ${removed} retirée(s), ${kept} conservée(s).`);
await db.end();
