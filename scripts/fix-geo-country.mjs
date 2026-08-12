#!/usr/bin/env node
/**
 * Corrige la GÉOLOCALISATION des artistes de la carte (pays + coordonnées).
 *
 * Problèmes traités :
 *  1. `country` stocke parfois le pays d'ORIGINE (MusicBrainz/Wikidata) au
 *     lieu du pays où l'artiste est réellement localisé. Un artiste d'origine
 *     US installé à Johannesburg garde country='US' → cluster « US » fantôme
 *     posé au-dessus de l'Afrique du Sud (mini-barre affichant « États-Unis »
 *     en zoomant sur ZA).
 *  2. Certains pins ont des coordonnées fausses à cause d'homonymies de
 *     villes (« Kano » → Kano, Japon au lieu de Kano, Nigéria).
 *
 * Algorithme par artiste :
 *   - l'audit partagé détecte d'abord les coordonnées aberrantes ;
 *   - un aberrant peut seulement être REPLACÉ dans le pays attendu ; son pays
 *     n'est jamais réécrit d'après la mauvaise coordonnée ;
 *   - hors aberrant, le pays n'est réaligné que si le reverse-géocodage et le
 *     pays déduit de la ville concordent ;
 *   - tout cas ambigu est refusé et laissé intact.
 *
 * Aucune donnée n'est inventée : un échec de géocodage laisse la ligne intacte.
 *
 * Usage :
 *   node scripts/fix-geo-country.mjs            # audit à blanc (aucune écriture)
 *   node scripts/fix-geo-country.mjs --apply    # applique les corrections sûres
 *   node scripts/fix-geo-country.mjs --dry      # explicite : affiche seulement
 *   node scripts/fix-geo-country.mjs --check    # audit seul, code 1 si incohérence
 *   node scripts/fix-geo-country.mjs --apply --id mb-…  # applique sur un artiste
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

import { geoCountryOf } from '../packages/shared/src/geo.ts'
import { splitGeoOutliers } from '../packages/shared/src/map/geo-consistency.ts'
import { planGeoRepair } from './lib/geo-repair.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const rootEnv = loadEnv(path.join(root, '.env'))
const webEnv = loadEnv(path.join(root, 'apps', 'web', '.env.local'))
const url = webEnv.VITE_SUPABASE_URL
const key = webEnv.VITE_SUPABASE_ANON_KEY
const mapboxToken = webEnv.VITE_MAPBOX_TOKEN
if (!url || !key || !mapboxToken) {
  console.error('Manquant : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_MAPBOX_TOKEN (apps/web/.env.local).')
  process.exit(1)
}
const api = `${url.replace(/\/$/, '')}/rest/v1`
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
}
const databasePassword = rootEnv.DATABASE_PASSWORD
const projectRef = url.replace(/^https:\/\/([a-z0-9]+)\..*$/, '$1')
const dbUrl = databasePassword
  ? `postgresql://postgres.${projectRef}:${databasePassword}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`
  : null
let dbClient = null

/**
 * Écriture administrative vérifiée. L'ancien PATCH REST utilisait la clé
 * anonyme : la RLS répondait sans erreur mais ne modifiait aucune ligne, puis
 * le script annonçait malgré tout « corrigé ».
 */
async function patchArtist(id, patch) {
  if (!dbUrl) throw new Error('DATABASE_PASSWORD manquant dans .env : correction impossible.')
  const allowed = new Set(['country', 'flag', 'lat', 'lng'])
  const entries = Object.entries(patch)
  if (entries.length === 0 || entries.some(([column]) => !allowed.has(column))) {
    throw new Error('Patch artiste invalide.')
  }
  if (!dbClient) {
    dbClient = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
    await dbClient.connect()
  }
  const values = entries.map(([, value]) => value)
  values.push(id)
  const setters = entries.map(([column], index) => `${column} = $${index + 1}`).join(', ')
  const result = await dbClient.query(
    `UPDATE map_artists SET ${setters} WHERE id = $${values.length} RETURNING id`,
    values,
  )
  if (result.rowCount !== 1) {
    throw new Error(`Correction non persistée pour ${id} (${result.rowCount ?? 0} ligne).`)
  }
}

const check = process.argv.includes('--check')
const apply = process.argv.includes('--apply')
const dry = !apply || process.argv.includes('--dry') || check
const onlyId = (() => {
  const i = process.argv.indexOf('--id')
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null
})()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function flagEmoji(code) {
  if (!code || code.length !== 2) return '🌍'
  const base = 0x1f1e6
  return String.fromCodePoint(
    base + code.charCodeAt(0) - 65,
    base + code.charCodeAt(1) - 65,
  )
}

/** Code pays du contexte d'un résultat Mapbox (short_code « bj », « fr-75 »…). */
function countryCodeOfFeature(feature) {
  const c = (feature.context ?? []).find((x) => (x.id ?? '').startsWith('country'))
  const sc = c?.short_code ?? ''
  const code = sc.replace(/^[a-z]{2}-/, '').toUpperCase()
  return code.length === 2 ? code : null
}

/** Reverse-géocodage : code ISO du pays de la coordonnée (ou null). */
async function reverseCountry(lng, lat) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng.toFixed(5)},${lat.toFixed(5)}.json?access_token=${mapboxToken}&limit=1&types=country`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const feature = data.features?.[0]
  // Pour un reverse de type country, le code est sur la feature elle-même
  // (properties.short_code « za »), pas dans le contexte.
  const own = feature?.properties?.short_code
  if (typeof own === 'string' && own.length === 2) return own.toUpperCase()
  if (typeof own === 'string') return own.replace(/^[a-z]{2}-/, '').toUpperCase()
  return countryCodeOfFeature(feature) ?? null
}

/**
 * Forward « ville, pays déclaré » (filtre pays) : résout la ville dans le
 * pays déclaré. Retourne { coords, country } ou null.
 */
async function forwardCity(city, declared) {
  if (!city?.trim()) return null
  const countryParam = declared && declared.length === 2 ? `&country=${declared}` : ''
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(city.trim())}.json` +
    `?access_token=${mapboxToken}&limit=1&types=place,locality,neighborhood${countryParam}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  const feature = data.features?.[0]
  const center = feature?.center
  if (!center || center.length !== 2) return null
  return { coords: [center[0], center[1]], country: countryCodeOfFeature(feature) ?? declared }
}

// Toujours charger le catalogue complet : la preuve d'aberration dépend de
// la position de l'artiste par rapport à son groupe, même avec `--id`.
const allRows = await fetch(`${api}/map_artists?select=id,name,city,country,lat,lng,flag&order=created_at.asc&limit=1000`, {
  headers,
})
  .then((r) => r.json())
  .catch(() => [])

if (!Array.isArray(allRows) || allRows.length === 0) {
  console.log('Aucun artiste à traiter.')
  process.exit(0)
}

const rows = onlyId ? allRows.filter((row) => row.id === onlyId) : allRows
if (rows.length === 0) {
  console.log(`Artiste introuvable : ${onlyId}`)
  process.exit(1)
}

function groupBy(list, keyOf) {
  const groups = new Map()
  for (const item of list) {
    const key = keyOf(item) || 'unknown'
    const bucket = groups.get(key)
    if (bucket) bucket.push(item)
    else groups.set(key, [item])
  }
  return groups
}

const locatable = allRows
  .filter((row) => Number.isFinite(Number(row.lng)) && Number.isFinite(Number(row.lat)))
  .map((row) => ({
    ...row,
    coordinates: [Number(row.lng), Number(row.lat)],
    expectedCountry: geoCountryOf(row.city ?? '', row.country ?? ''),
  }))
const outlierIds = new Set()
for (const members of groupBy(locatable, (row) => row.expectedCountry).values()) {
  for (const outlier of splitGeoOutliers(members).outliers) outlierIds.add(outlier.id)
}

let fixedCountry = 0
let fixedCoords = 0
let skipped = 0
let failed = 0
let refused = 0
let issues = 0
console.log(`Géocodage de ${rows.length} artiste(s)…`)

for (const row of rows) {
  const lat = Number(row.lat)
  const lng = Number(row.lng)
  const declared = (row.country ?? '').trim().toUpperCase()
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    skipped += 1
    continue
  }
  const real = await reverseCountry(lng, lat)
  await sleep(60)
  const expected = geoCountryOf(row.city ?? '', row.country ?? '')
  const isOutlier = outlierIds.has(row.id)
  const forwardDeclared = isOutlier ? await forwardCity(row.city, declared) : null
  const forwardReverse = !isOutlier && real && real !== declared
    ? await forwardCity(row.city, real)
    : null
  if (forwardDeclared || forwardReverse) await sleep(60)
  const plan = planGeoRepair({
    declaredCountry: declared,
    reverseCountry: real,
    isOutlier,
    forwardDeclared,
    forwardReverse,
  })

  if (plan.kind === 'none') continue
  if (plan.kind === 'coordinates') {
    const [fLng, fLat] = plan.coords
    const action = dry ? '[DRY] déplacerait' : 'déplace'
    console.log(`  ${action} ${row.name}: coords → ${fLat.toFixed(3)},${fLng.toFixed(3)} (${row.city}, ${expected})`)
    issues += 1
    if (!dry) {
      await patchArtist(row.id, { lat: fLat, lng: fLng })
      fixedCoords += 1
    }
    continue
  }

  if (plan.kind === 'country') {
    const action = dry ? '[DRY] corrigerait' : 'corrige'
    console.log(`  ${action} ${row.name}: ${declared || '∅'} → ${plan.country} (${row.city ?? ''})`)
    issues += 1
    if (!dry) {
      await patchArtist(row.id, { country: plan.country, flag: flagEmoji(plan.country) })
      fixedCountry += 1
    }
    continue
  }

  issues += 1
  refused += 1
  if (!real) failed += 1
  console.warn(`  [REFUS] ${row.name}: ${plan.reason} (${row.city ?? ''}, ${declared || '∅'}; pin=${real || '∅'}; attendu=${expected || '∅'})`)
}

if (dbClient) await dbClient.end()

console.log(`\nTerminé. ${fixedCountry} pays corrigé(s), ${fixedCoords} coordonnées corrigée(s), ${refused} cas refusé(s), ${skipped} sans coordonnées, ${failed} sans résolution.`)

if (check && issues > 0) {
  console.error(`${issues} incohérence(s) géographique(s) détectée(s).`)
  process.exit(1)
}
