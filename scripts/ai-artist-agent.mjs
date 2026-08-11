#!/usr/bin/env node
/**
 * Agent IA Musimaps — vérification, comparaison et filtrage intelligent des
 * artistes via Mistral.
 *
 * Modes :
 *   --artist "Nom"    AGENT À OUTILS (pattern LangGraph, scripts/lib/ai-agent.mjs) :
 *                     search → details → verify (Wikidata anti-politicien)
 *                     → enrich (Wikipedia bio/photo) → locate (Mapbox)
 *                     → verdict Mistral (keep / review / reject).
 *   --map [--limit N] Audite et enrichit TOUS les artistes de la carte :
 *                     genre/bio corrigés via le RPC, non-musiciens signalés
 *                     (l'admin les retire via l'interface).
 *   --city "Lagos"    Peuplement d'une ville vérifié par l'IA
 *                     (délègue à populate-map.mjs --ai).
 *   --dry-run         Ne rien écrire, afficher seulement.
 *   --limit N         Nombre max d'artistes à traiter (--map).
 *   --chunk N         Taille des lots envoyés à Mistral (défaut 10).
 *
 * Exemples :
 *   node scripts/ai-artist-agent.mjs --artist "Booba"
 *   node scripts/ai-artist-agent.mjs --map --limit 30 --dry-run
 *   node scripts/ai-artist-agent.mjs --map --limit 200
 *   node scripts/ai-artist-agent.mjs --city "Lagos" --dry-run
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  aiVerifyArtists,
  loadEnv,
  loadMistralKey,
} from './lib/ai-verify.mjs'
import { runArtistAgent, loadMapboxToken } from './lib/ai-agent.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mapboxToken = loadMapboxToken(root)

/* ---------------------------------------------------------------- */
/* Env Supabase (REST) + Mistral                                     */
/* ---------------------------------------------------------------- */
const webEnv = loadEnv(path.join(root, 'apps', 'web', '.env.local'))
const url = webEnv.VITE_SUPABASE_URL
const key = webEnv.VITE_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('Manquant : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (apps/web/.env.local).')
  process.exit(1)
}
const api = `${url.replace(/\/$/, '')}/rest/v1`
const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
}
const mistralKey = loadMistralKey(root)
if (!mistralKey) {
  console.error('Manquant : MISTRAL_API_KEY dans le .env racine.')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}
const hasFlag = (name) => process.argv.includes(`--${name}`)

const MODE = hasFlag('artist') ? 'artist' : hasFlag('map') ? 'map' : hasFlag('city') ? 'city' : null
const DRY_RUN = hasFlag('dry-run')
const LIMIT = parseInt(arg('limit', '0'), 10) || 0
const CHUNK = parseInt(arg('chunk', '10'), 10) || 10

/* ---------------------------------------------------------------- */
/* Helpers réseau                                                   */
/* ---------------------------------------------------------------- */const flagFor = (cc) => {
  if (!cc || cc.length !== 2) return '🌍'
  const base = 0x1f1e6
  return String.fromCodePoint(base + cc.charCodeAt(0) - 65, base + cc.charCodeAt(1) - 65)
}

/* ---------------------------------------------------------------- */
/* Deep search multi-sources : délégué à l'agent à outils            */
/* (scripts/lib/ai-agent.mjs — même logique que l'edge function)     */
/* ---------------------------------------------------------------- */

/* ---------------------------------------------------------------- */
/* Mode --artist : deep search d'un artiste                         */
/* ---------------------------------------------------------------- */
async function runArtistMode(name) {
  console.log(`\n🤖 Agent à outils (deep search multi-sources + vérification IA) : « ${name} »\n`)
  // L'agent enchaîne : search → details → verify (Wikidata anti-politicien)
  // → enrich (Wikipedia bio/photo) → locate (Mapbox) → verdict Mistral.
  const state = await runArtistAgent(name, {
    apiKey: mistralKey,
    mapboxToken,
    maxSteps: 8,
    log: (msg) => console.log(msg),
  })
  console.log('')
  const c = state.candidate
  if (state.status === 'empty') {
    console.log('✗ Aucun résultat trouvé pour cet artiste.')
    return
  }
  const v = state.verdict
  const icon =
    state.status === 'rejected' ? '⛔' : v?.verdict === 'review' ? '⚠️' : v?.verdict === 'reject' ? '⛔' : '✅'
  console.log(`${icon} ${c.name}${c.type ? ` — ${c.type}` : ''}`)
  if (c.disambiguation) console.log(`     disambiguation : ${c.disambiguation}`)
  if (v?.reason) console.log(`     raison : ${v.reason}`)
  if (c.genre || v?.genre) console.log(`     genre  : ${v?.genre || c.genre}`)
  if (c.country || c.city) console.log(`     lieu   : ${[c.city, c.country].filter(Boolean).join(', ') || 'inconnu'}`)
  if (c.bio) console.log(`     bio    : ${c.bio.slice(0, 180)}${c.bio.length > 180 ? '…' : ''}`)
  if (c.image) console.log(`     image  : ${c.image.slice(0, 90)}`)
  if (c.lat && c.lng) console.log(`     coord  : ${c.lat.toFixed(3)}, ${c.lng.toFixed(3)}`)
  console.log('\nTip : node scripts/ai-artist-agent.mjs --map pour auditer la carte entière.')
}

/* ---------------------------------------------------------------- */
/* Mode --map : audit + enrichissement de la carte                   */
/* ---------------------------------------------------------------- */
async function fetchMapArtists(limit) {
  const res = await fetch(
    `${api}/map_artists?select=id,name,genre,city,country,flag,lat,lng,bio,image,source&order=created_at.desc&limit=${limit || 500}`,
    { headers },
  )
  if (!res.ok) throw new Error(`REST ${res.status}`)
  return res.json()
}

/** Écrit le profil via le RPC sécurisé (reprend le payload complet). */
async function rpcUpsert(artist) {
  const res = await fetch(`${api}/rpc/add_or_update_map_artist`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      p_artist: {
        id: artist.id,
        name: artist.name,
        genre: artist.genre ?? '',
        city: artist.city ?? '',
        country: artist.country ?? '',
        flag: artist.flag ?? flagFor(artist.country),
        lat: artist.lat,
        lng: artist.lng,
        bio: artist.bio ?? '',
        image: artist.image ?? null,
        source: artist.source ?? 'musicbrainz',
        platforms: {},
        socials: {},
      },
    }),
  })
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`)
  const body = await res.json().catch(() => null)
  return body?.ok === true
}

async function runMapMode() {
  console.log(`\n🗺️  Audit IA de la carte${DRY_RUN ? ' (DRY RUN — aucune écriture)' : ''}\n`)
  const artists = await fetchMapArtists(LIMIT)
  console.log(`Artistes chargés : ${artists.length}`)

  const report = { processed: 0, kept: 0, corrected: 0, review: [], reject: [] }
  for (let i = 0; i < artists.length; i += CHUNK) {
    const chunk = artists.slice(i, i + CHUNK)
    const results = await aiVerifyArtists(
      chunk.map((a) => ({
        id: a.id,
        name: a.name,
        genre: a.genre ?? '',
        country: a.country ?? '',
        city: a.city ?? '',
        bio: a.bio ?? '',
        source: a.source ?? '',
      })),
      { apiKey: mistralKey, batch: CHUNK },
    )
    for (const r of results ?? []) {
      const a = chunk.find((x) => x.id === r.id)
      if (!a) continue
      report.processed += 1
      if (r.verdict === 'reject') {
        report.reject.push({ id: a.id, name: a.name, reason: r.reason })
        console.log(`⛔ ${a.name} — ${r.reason}`)
        continue
      }
      if (r.verdict === 'review') {
        report.review.push({ id: a.id, name: a.name, reason: r.reason })
        console.log(`⚠️  ${a.name} — ${r.reason}`)
      }
      report.kept += 1

      const genre = r.genre && r.genre !== (a.genre ?? '') ? r.genre : null
      const bio =
        r.bio && r.bio.length >= 40 && r.bio !== (a.bio ?? '') ? r.bio : null
      if (!genre && !bio) continue

      report.corrected += 1
      if (DRY_RUN) {
        console.log(`  ~ ${a.name} : genre « ${a.genre} » → « ${genre ?? a.genre} »`)
        continue
      }
      try {
        await rpcUpsert({
          ...a,
          genre: genre ?? a.genre,
          bio: bio ?? a.bio,
        })
        console.log(`  ✓ ${a.name} enrichi (${[genre && `genre=${genre}`, bio && `bio=${bio.length}c`].filter(Boolean).join(', ')})`)
      } catch (e) {
        console.log(`  ✗ ${a.name} : ${e.message}`)
      }
    }
    await sleep(600)
  }

  // Rapport persistant + affichage synthèse.
  const reportFile = path.join(root, '.freebuff', 'ai-agent-report.json')
  try {
    mkdirSync(path.dirname(reportFile), { recursive: true })
    writeFileSync(reportFile, JSON.stringify(report, null, 2))
  } catch {
    /* rapport non persistant */
  }
  console.log('\n────────────────────────────────────────────')
  console.log(`Traité : ${report.processed} · conservé : ${report.kept} · corrigé : ${report.corrected}`)
  console.log(`À vérifier (admin) : ${report.review.length} · non-musiciens supposés : ${report.reject.length}`)
  if (report.reject.length > 0) {
    console.log('\nNon-musiciens supposés (à retirer depuis l’admin → Artistes découverts) :')
    for (const r of report.reject) console.log(`  • ${r.name} (${r.id}) — ${r.reason}`)
  }
  console.log(`\nRapport complet : ${reportFile}`)
}

/* ---------------------------------------------------------------- */
/* Mode --city : peuplement IA d'une ville                           */
/* ---------------------------------------------------------------- */
async function runCityMode(city) {
  const cmd = [
    'node',
    path.join(root, 'scripts', 'populate-map.mjs'),
    '--city', `"${city}"`,
    '--ai',
    DRY_RUN ? '--dry-run' : '',
  ].filter(Boolean).join(' ')
  console.log(`\n🏙️  Peuplement vérifié par l'IA : ${city}\n`)
  execSync(cmd, { cwd: root, stdio: 'inherit' })
}

/* ---------------------------------------------------------------- */
/* Main                                                             */
/* ---------------------------------------------------------------- */
async function main() {
  if (!MODE) {
    console.error(
      'Usage : node scripts/ai-artist-agent.mjs --artist "Nom" | --map | --city "Ville" [--dry-run] [--limit N]',
    )
    process.exit(1)
  }
  if (MODE === 'artist') await runArtistMode(arg('artist'))
  else if (MODE === 'map') await runMapMode()
  else await runCityMode(arg('city'))
}

main().catch((e) => {
  console.error('Erreur fatale :', e.message)
  process.exit(1)
})
