#!/usr/bin/env node
/**
 * AUDIT de cohérence géographique des artistes de la carte.
 *
 * Ne modifie rien, ne demande aucune clé Mapbox, ne fait aucun appel réseau
 * sortant hors base : il applique la MÊME détection que la carte
 * (`splitGeoOutliers` dans packages/shared/src/map) et liste les artistes
 * dont la coordonnée contredit le groupe où leur `city` / `country` les place.
 *
 *   node scripts/audit-geo.mjs            # rapport lisible
 *   node scripts/audit-geo.mjs --json     # sortie machine
 *
 * C'est le pendant « constat » de scripts/fix-geo-country.mjs, qui lui
 * répare (et a besoin du réseau). On regarde avant de corriger.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { geoCountryOf, flagFor, countryByCode } from '../packages/shared/src/geo.ts';
import { splitGeoOutliers, distanceKm, median } from '../packages/shared/src/map/geo-consistency.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..');

/** Lit un fichier .env en couples clé/valeur. */
function loadEnv(file) {
  const full = path.resolve(ROOT, file);
  const out = {};
  if (!existsSync(full)) return out;
  for (const line of readFileSync(full, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) out[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

// Même convention que scripts/db-migrate.mjs et scripts/fix-geo-country.mjs :
// mot de passe à la racine, référence du projet déduite de l'URL Supabase.
const rootEnv = loadEnv('.env');
const webEnv = loadEnv('apps/web/.env.local');
const password = rootEnv.DATABASE_PASSWORD;
const supabaseUrl = webEnv.VITE_SUPABASE_URL;
if (!password || !supabaseUrl) {
  console.error(
    'Manquant : DATABASE_PASSWORD (.env racine) ou VITE_SUPABASE_URL (apps/web/.env.local).',
  );
  process.exit(1);
}
const ref = supabaseUrl.replace(/^https:\/\/([a-z0-9]+)\..*$/, '$1');
const connectionString = `postgresql://postgres.${ref}:${password}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows } = await client.query(
  `SELECT id, name, city, country, flag, lat, lng
     FROM map_artists
    WHERE lat IS NOT NULL AND lng IS NOT NULL`,
);
await client.end();

/** Même forme que l'objet Artist attendu par la détection partagée. */
const artists = rows.map((row) => ({
  id: row.id,
  name: row.name ?? '',
  city: row.city ?? '',
  country: row.country ?? '',
  flag: row.flag ?? '',
  coordinates: [Number(row.lng), Number(row.lat)],
}));

// On reproduit exactement le regroupement de la carte : par PAYS GÉO déduit
// du texte déclaré, puis par ville.
function groupBy(list, keyOf) {
  const map = new Map();
  for (const item of list) {
    const key = keyOf(item) || 'unknown';
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

const byCountry = groupBy(artists, (a) => geoCountryOf(a.city, a.country));

const findings = [];
for (const [code, members] of byCountry) {
  const { inside, outliers } = splitGeoOutliers(members);
  if (outliers.length === 0) continue;
  const centre = [
    median(inside.map((a) => a.coordinates[0])),
    median(inside.map((a) => a.coordinates[1])),
  ];
  for (const artist of outliers) {
    findings.push({
      id: artist.id,
      name: artist.name,
      declaredCity: artist.city,
      declaredCountry: artist.country,
      groupCode: code,
      groupName: countryByCode(code)?.fr ?? code,
      groupFlag: flagFor(code),
      coordinates: artist.coordinates,
      kmFromGroup: Math.round(distanceKm(artist.coordinates, centre)),
      groupSize: members.length,
    });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(findings, null, 2));
  process.exit(findings.length > 0 ? 1 : 0);
}

console.log(`${artists.length} artistes géolocalisés analysés.\n`);
if (findings.length === 0) {
  console.log('Aucune incohérence détectée.');
  process.exit(0);
}

findings.sort((a, b) => b.kmFromGroup - a.kmFromGroup);
console.log(`${findings.length} artiste(s) incohérent(s) :\n`);
for (const f of findings) {
  console.log(`  ${f.groupFlag} ${f.groupName} — ${f.name}`);
  console.log(`     declare : ${f.declaredCity || '(sans ville)'}, ${f.declaredCountry || '(sans pays)'}`);
  console.log(`     pin a   : ${f.coordinates[1].toFixed(3)}, ${f.coordinates[0].toFixed(3)}`);
  console.log(`     ecart   : ${f.kmFromGroup} km du groupe (${f.groupSize} membres)`);
  console.log(`     id      : ${f.id}\n`);
}
console.log('Pour reparer : node scripts/fix-geo-country.mjs (necessite une cle Mapbox).');
process.exit(1);
