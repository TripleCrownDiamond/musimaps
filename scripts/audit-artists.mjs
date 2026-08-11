/**
 * Audit des localisations des artistes de la carte (map_artists).
 *
 * Pour chaque artiste : reverse-géocodage Mapbox des coordonnées (lat/lng)
 * et comparaison avec le pays déclaré. Signale :
 *   - coordonnées dans un pays DIFFÉRENT du pays déclaré (ex. Cotonou/BJ
 *     placé en Biélorussie),
 *   - coordonnées sans pays (océan, pôle, ville inconnue),
 *   - pays déclaré absent ou invalide.
 *
 * Usage : node scripts/audit-artists.mjs [--json]
 * Lit VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / VITE_MAPBOX_TOKEN
 * depuis apps/web/.env.local.
 */
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const webEnvFile = path.join(root, 'apps', 'web', '.env.local')

function loadEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return out
}

const env = loadEnv(webEnvFile)
const anon = env.VITE_SUPABASE_ANON_KEY
const token = env.VITE_MAPBOX_TOKEN
const url = env.VITE_SUPABASE_URL
if (!anon || !token || !url) {
  console.error('Manquant : VITE_SUPABASE_ANON_KEY / VITE_MAPBOX_TOKEN / VITE_SUPABASE_URL dans apps/web/.env.local')
  process.exit(1)
}
const host = url.replace(/^https:\/\//, '')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Normalise un pays déclaré en code ISO court quand c'est possible. */
function normalizeCountry(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase()
  const map = {
    benin: 'BJ', benin: 'BJ', france: 'FR', fr: 'FR',
    nigeria: 'NG', ghana: 'GH', senegal: 'SN', 'cote d ivoire': 'CI', "cote d'ivoire": 'CI', 'ivory coast': 'CI',
    cameroon: 'CM', cameroun: 'CM', togo: 'TG', usa: 'US', 'united states': 'US', 'united states of america': 'US',
    uk: 'GB', 'united kingdom': 'GB', belarus: 'BY', belarus: 'BY', russia: 'RU', canada: 'CA',
    germany: 'DE', belgique: 'BE', belgium: 'BE', suisse: 'CH', switzerland: 'CH',
  }
  const key = s.toLowerCase()
  return map[key] ?? s.toUpperCase().slice(0, 2)
}

async function reverseCountry(lng, lat) {
  const r = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=country&limit=1`,
  )
  if (!r.ok) return null
  const data = await r.json()
  const f = data?.features?.[0]
  if (!f) return null
  const sc = f.properties?.short_code ?? ''
  return { code: sc.replace(/^[a-z]{2}-/, '').toUpperCase() || null, name: f.text ?? '' }
}

async function main() {
  const r = await fetch(
    `https://${host}/rest/v1/map_artists?select=id,name,city,country,lat,lng,genre&limit=1000`,
    { headers: { apikey: anon, Authorization: `Bearer ${anon}` } },
  )
  if (!r.ok) {
    console.error('Lecture map_artists impossible :', r.status)
    process.exit(1)
  }
  const rows = await r.json()
  console.log(`Total artistes : ${rows.length}`)
  const issues = []
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i]
    if (a.lat == null || a.lng == null || Number.isNaN(Number(a.lat)) || Number.isNaN(Number(a.lng))) {
      issues.push({ ...a, problem: 'coords manquantes' })
      continue
    }
    const rev = await reverseCountry(Number(a.lng), Number(a.lat))
    if (!rev || !rev.code) {
      issues.push({ ...a, problem: 'pas de pays aux coordonnées (océan/ville inconnue)', rev })
      await sleep(80)
      continue
    }
    const declared = normalizeCountry(a.country)
    if (declared && declared !== rev.code) {
      issues.push({ ...a, problem: `PINS DANS ${rev.name} (${rev.code}) ≠ pays déclaré ${declared}`, rev })
    }
    await sleep(80)
  }
  console.log(`\nProblèmes détectés : ${issues.length}\n`)
  for (const it of issues) {
    console.log(
      `- [${it.problem}] ${it.name} | city=${it.city} country=${it.country} | lat=${it.lat} lng=${it.lng}${it.rev?.name ? ` → ${it.rev.name} (${it.rev.code})` : ''}`,
    )
  }
  if (process.argv.includes('--json')) {
    console.log('\nJSON:')
    console.log(JSON.stringify(issues, null, 2))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
