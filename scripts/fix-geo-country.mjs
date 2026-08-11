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
 *   - reverse-géocodage des coordonnées → pays réel `real`.
 *   - si `real` == pays déclaré → OK (rien à faire).
 *   - sinon, on re-tente un forward « ville, pays déclaré » (filtre pays) :
 *       * s'il résout DANS le pays déclaré → les COORDONNÉES étaient fausses
 *         (homonymie) → on corrige les coordonnées, on garde le pays déclaré ;
 *       * sinon → le PAYS déclaré est faux → on corrige pays + drapeau avec
 *         le pays réel.
 *
 * Aucune donnée n'est inventée : un échec de géocodage laisse la ligne intacte.
 *
 * Usage :
 *   node scripts/fix-geo-country.mjs            # corrige tout
 *   node scripts/fix-geo-country.mjs --dry      # affiche seulement les changements
 *   node scripts/fix-geo-country.mjs --id mb-…  # corrige un seul artiste
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

const dry = process.argv.includes('--dry')
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

const query = onlyId
  ? `id=eq.${encodeURIComponent(onlyId)}`
  : 'order=created_at.asc&limit=1000'

const rows = await fetch(`${api}/map_artists?select=id,name,city,country,lat,lng,flag&${query}`, {
  headers,
})
  .then((r) => r.json())
  .catch(() => [])

if (!Array.isArray(rows) || rows.length === 0) {
  console.log('Aucun artiste à traiter.')
  process.exit(0)
}

let fixedCountry = 0
let fixedCoords = 0
let skipped = 0
let failed = 0
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
  if (!real) {
    failed += 1
    continue
  }
  if (real === declared) continue

  // La ville existe-t-elle dans le pays GÉOGRAPHIQUE ? « Johannesburg, ZA »
  // résout → le pin est bien posé dans le pays géo → le pays déclaré était
  // l'origine (diaspora), on corrige le pays. « Kano, JP » ne résout pas
  // (homonymie) → on tente alors la ville dans le pays déclaré pour corriger
  // les coordonnées fausses (Kano, Nigéria).
  const fwdGeo = await forwardCity(row.city, real)
  await sleep(60)

  if (fwdGeo && fwdGeo.country === real) {
    // Pin correctement posé dans le pays géographique → pays déclaré = origine.
    const action = dry ? '[DRY] corrigerait' : 'corrige'
    console.log(`  ${action} ${row.name}: ${declared || '∅'} → ${real} (${row.city ?? ''})`)
    if (!dry) {
      await fetch(`${api}/map_artists?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ country: real, flag: flagEmoji(real) }),
      })
      fixedCountry += 1
    }
    continue
  }

  // La ville n'existe pas dans le pays géo : tentative « ville, pays déclaré »
  // — corrige les homonymies (« Kano » → Japon au lieu du Nigéria).
  const fwdDecl = await forwardCity(row.city, declared)
  await sleep(60)
  if (fwdDecl && fwdDecl.country === declared) {
    const [fLng, fLat] = fwdDecl.coords
    const action = dry ? '[DRY] déplacerait' : 'déplace'
    console.log(`  ${action} ${row.name}: coords → ${fLat.toFixed(3)},${fLng.toFixed(3)} (${row.city}, ${declared})`)
    if (!dry) {
      await fetch(`${api}/map_artists?id=eq.${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ lat: fLat, lng: fLng }),
      })
      fixedCoords += 1
    }
    continue
  }

  // Ni l'un ni l'autre : on garde les coordonnées, on aligne le pays sur le
  // pays géographique réel (cohérence pin ↔ libellé).
  const action = dry ? '[DRY] corrigerait' : 'corrige'
  console.log(`  ${action} ${row.name}: ${declared || '∅'} → ${real} (${row.city ?? ''})`)
  if (!dry) {
    await fetch(`${api}/map_artists?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ country: real, flag: flagEmoji(real) }),
    })
    fixedCountry += 1
  }
}

console.log(`\nTerminé. ${fixedCountry} pays corrigé(s), ${fixedCoords} coordonnées corrigée(s), ${skipped} sans coordonnées, ${failed} sans résolution.`)
