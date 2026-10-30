#!/usr/bin/env node
/**
 * Peuplement « scène de la baie de San Francisco » de la carte Musimaps.
 *
 * Même moteur et mêmes règles que populate-togo.mjs : Deezer (photo HD,
 * fans, lien), iTunes (lien Apple Music), Wikipédia (bio) — JAMAIS d'ajout
 * sans image vérifiée, JAMAIS de lien non confirmé par une API. Villes :
 * San Francisco et la baie (Oakland, Berkeley, Vallejo, El Cerrito,
 * San Jose), selon l'attache documentée de chaque artiste.
 * id us-<slug>, country US. 40 entrées au plus : la limite d'ajouts par
 * jour et par origine (migration 00083) est de 40.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
  return out
}
const envRoot = loadEnv(path.join(root, '.env'))
const webEnv = loadEnv(path.join(root, 'apps', 'web', '.env.local'))
const SUPABASE_URL = webEnv.VITE_SUPABASE_URL
const SUPABASE_KEY = webEnv.VITE_SUPABASE_ANON_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Manquant : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (apps/web/.env.local).')
  process.exit(1)
}
const REST = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`
const HEADERS = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' }
const UA = 'MusiMaps/1.0 (https://musimaps.com; san francisco curation script)'
const DRY_RUN = process.argv.includes('--dry-run')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------------------------------------------------------------- */
/* Données : 40 artistes de la baie de San Francisco                 */
/* ---------------------------------------------------------------- */
const CITIES = {
  SF: { city: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  OAK: { city: 'Oakland', lat: 37.8044, lng: -122.2712 },
  BRK: { city: 'Berkeley', lat: 37.8715, lng: -122.273 },
  VAL: { city: 'Vallejo', lat: 38.1041, lng: -122.2566 },
  ELC: { city: 'El Cerrito', lat: 37.9161, lng: -122.3108 },
  SJ: { city: 'San Jose', lat: 37.3382, lng: -121.8863 },
}

const ARTISTS = [
  { name: 'Santana', key: 'SF', genre: 'Rock latino' },
  { name: 'Journey', key: 'SF', genre: 'Rock' },
  { name: 'Grateful Dead', key: 'SF', district: 'Haight-Ashbury', genre: 'Rock psychédélique' },
  { name: 'Jefferson Airplane', key: 'SF', district: 'Haight-Ashbury', genre: 'Rock psychédélique' },
  { name: 'Metallica', key: 'SF', genre: 'Metal' },
  { name: 'Sly & the Family Stone', key: 'SF', genre: 'Funk / Soul' },
  { name: '4 Non Blondes', key: 'SF', genre: 'Rock alternatif' },
  { name: 'Third Eye Blind', key: 'SF', genre: 'Rock alternatif' },
  { name: '24kGoldn', key: 'SF', genre: 'Hip-hop / Pop' },
  { name: 'Larry June', key: 'SF', genre: 'Hip-hop' },
  { name: 'Huey Lewis and the News', key: 'SF', genre: 'Rock / Pop' },
  { name: 'Big Brother and the Holding Company', key: 'SF', district: 'Haight-Ashbury', genre: 'Rock psychédélique / Blues' },
  { name: 'Dead Kennedys', key: 'SF', genre: 'Punk' },
  { name: 'Faith No More', key: 'SF', genre: 'Metal alternatif' },
  { name: 'Chris Isaak', key: 'SF', genre: 'Rock / Rockabilly' },
  { name: 'Train', key: 'SF', genre: 'Pop rock' },
  { name: 'Steve Miller Band', key: 'SF', genre: 'Rock / Blues' },
  { name: 'Osees', key: 'SF', genre: 'Garage rock' },
  { name: 'Primus', key: 'SF', genre: 'Funk metal / Rock alternatif' },
  { name: 'Tycho', key: 'SF', genre: 'Électronique / Ambient' },
  { name: 'Deerhoof', key: 'SF', genre: 'Rock indépendant' },
  { name: 'Kehlani', key: 'OAK', genre: 'R&B' },
  { name: 'Too $hort', key: 'OAK', genre: 'Hip-hop' },
  { name: 'Tower of Power', key: 'OAK', genre: 'Funk / Soul' },
  { name: 'G-Eazy', key: 'OAK', genre: 'Hip-hop' },
  { name: 'Tony! Toni! Toné!', key: 'OAK', genre: 'R&B / New jack swing' },
  { name: 'MC Hammer', key: 'OAK', genre: 'Hip-hop' },
  { name: 'Digital Underground', key: 'OAK', genre: 'Hip-hop / Funk' },
  { name: 'Sheila E.', key: 'OAK', genre: 'Pop / Percussions' },
  { name: 'En Vogue', key: 'OAK', genre: 'R&B' },
  { name: 'Keyshia Cole', key: 'OAK', genre: 'R&B' },
  { name: 'Green Day', key: 'BRK', genre: 'Punk rock' },
  { name: 'Rancid', key: 'BRK', genre: 'Punk rock / Ska' },
  { name: 'Counting Crows', key: 'BRK', genre: 'Rock alternatif' },
  { name: 'Toro y Moi', key: 'BRK', genre: 'Chillwave / Indie' },
  { name: 'E-40', key: 'VAL', genre: 'Hip-hop' },
  { name: 'Mac Dre', key: 'VAL', genre: 'Hip-hop' },
  { name: 'Creedence Clearwater Revival', key: 'ELC', genre: 'Rock' },
  { name: 'The Doobie Brothers', key: 'SJ', genre: 'Rock' },
  { name: 'Smash Mouth', key: 'SJ', genre: 'Pop rock' },
]


/* ---------------------------------------------------------------- */
/* Helpers                                                           */
/* ---------------------------------------------------------------- */
function normalize(value) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
function slugify(value) {
  return normalize(value).replace(/ +/g, '-').slice(0, 80)
}
const flagFor = (cc) =>
  String.fromCodePoint(0x1f1e6 + cc.charCodeAt(0) - 65, 0x1f1e6 + cc.charCodeAt(1) - 65)

async function getJson(url, opts = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': UA, ...opts.headers },
    signal: opts.signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url.slice(0, 90)}`)
  return res.json()
}

async function imageOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } })
    const type = res.headers.get('content-type') ?? ''
    return res.ok && type.startsWith('image/')
  } catch {
    return false
  }
}

/* ---------------------------------------------------------------- */
/* Enrichissement par API                                            */
/* ---------------------------------------------------------------- */
async function deezerArtist(name) {
  const nName = normalize(name)
  const search = async (q) => {
    const data = await getJson(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=10`)
    return (data?.data ?? []).filter((a) => a?.name && a?.id)
  }
  try {
    const results = await search(name)
    const pool = results.filter((a) => normalize(a.name) === nName)
    const hit = (pool.length > 0 ? pool : []).reduce(
      (best, a) => ((a.nb_fan ?? 0) > (best?.nb_fan ?? -1) ? a : best),
      null,
    )
    if (!hit) return null
    return {
      id: hit.id,
      name: hit.name,
      nb_fan: hit.nb_fan ?? 0,
      picture: hit.picture_xl || hit.picture_big || '',
      link: hit.link || `https://www.deezer.com/artist/${hit.id}`,
    }
  } catch {
    return null
  }
}

/** iTunes : lien Apple Music vérifié (recherche, ou lookup par id fourni). */
async function appleMusicLink(name, appleId) {
  try {
    if (appleId) {
      const data = await getJson(`https://itunes.apple.com/lookup?id=${appleId}&entity=musicArtist`)
      const hit = (data?.results ?? []).find((r) => r.wrapperType === 'artist' && r.artistLinkUrl)
      return hit ? hit.artistLinkUrl : null
    }
    const data = await getJson(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&limit=5`,
    )
    const nName = normalize(name)
    const hit = (data?.results ?? []).find((r) => normalize(r.artistName ?? '') === nName && r.artistLinkUrl)
    return hit ? hit.artistLinkUrl : null
  } catch {
    return null
  }
}

/** Spotify : n'accepte l'URL que si l'oEmbed confirme le nom de l'artiste. */
async function spotifyVerified(name, spotifyUrl) {
  if (!spotifyUrl) return null
  try {
    const data = await getJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(spotifyUrl)}`)
    const title = normalize(data?.title ?? '')
    const nName = normalize(name)
    return title && (title === nName || title.includes(nName) || nName.includes(title)) ? spotifyUrl : null
  } catch {
    return null
  }
}

/** Wikipédia : bio + image (fr d'abord, puis en ; titre exact puis recherche). */
async function wikipedia(name) {
  const nName = normalize(name)
  const summary = async (title, lang) => {
    const base = lang === 'fr' ? 'https://fr.wikipedia.org' : 'https://en.wikipedia.org'
    const data = await getJson(`${base}/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    const image = data?.originalimage?.source ?? data?.thumbnail?.source ?? ''
    return { bio: (data?.extract ?? '').slice(0, 400), image: image ? image.split('?')[0] : '' }
  }
  for (const lang of ['fr', 'en']) {
    try {
      const direct = await summary(name.replace(/ /g, '_'), lang)
      if (direct.image || direct.bio) return direct
    } catch { /* recherche */ }
    try {
      const base = lang === 'fr' ? 'fr.wikipedia.org' : 'en.wikipedia.org'
      const search = await getJson(
        `https://${base}/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`"${name}"`)}` +
          `&gsrlimit=10&prop=pageprops&format=json&origin=*`,
      )
      const pages = Object.values(search?.query?.pages ?? {})
      const candidate = pages.find(
        (p) => p.title && !p.pageprops?.disambiguation && normalize(p.title) === nName,
      )
      if (candidate) return await summary(candidate.title.replace(/ /g, '_'), lang)
    } catch { /* langue suivante */ }
  }
  return { bio: '', image: '' }
}

/* ---------------------------------------------------------------- */
/* Upsert via RPC (idempotent, curation préservée)                   */
/* ---------------------------------------------------------------- */
async function upsert(payload) {
  const res = await fetch(`${REST}/rpc/add_or_update_map_artist`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ p_artist: payload }),
  })
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
  const body = await res.json().catch(() => null)
  return body?.ok ? { ok: true, updated: body.updated === true } : { ok: false, error: body?.error ?? 'rpc' }
}

/* ---------------------------------------------------------------- */
/* Main                                                              */
/* ---------------------------------------------------------------- */
async function main() {
  // Lignes existantes : dédoublonnage par nom normalisé + ids à enrichir.
  // Dédoublonnage via l'API REST publique (Postgres direct est sujet au DNS).
  let rows = []
  try {
    const res = await fetch(`${REST}/map_artists?select=id,name&limit=1000`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } })
    if (res.ok) rows = await res.json()
  } catch { /* repli : dédoublonnage par id seul */ }
  const byName = new Map()
  for (const r of rows) byName.set(normalize(r.name), r)

  console.log(`Peuplement baie de San Francisco — ${ARTISTS.length} entrées${DRY_RUN ? ' (DRY RUN)' : ''}\n`)
  const report = { added: [], enriched: [], skipped: [], errors: [] }
  const counters = { added: 0, enriched: 0 }

  /** Traite une entrée : enrichissement API, gate image, upsert. */
  async function processOne(a, index) {
    const label = `[${index + 1}/${ARTISTS.length}] ${a.name}`
    const existing = byName.get(normalize(a.name))
    if (existing && !a.enrichOnly) {
      console.log(`~ ${label} — déjà en base (« ${existing.name} »), ignoré`)
      report.skipped.push({ name: a.name, reason: 'duplicate' })
      return
    }
    const id = a.enrichOnly ? existing.id : `us-${slugify(a.name)}`

    // Enrichissement en parallèle par artiste : Deezer, Wikipédia, liens.
    // Deezer essaie le nom réel puis les variantes documentées (Willy/Wily…).
    const [dz, wiki, spotify, apple] = await Promise.all([
      (async () => {
        for (const candidate of [a.name, ...(a.aliases ?? [])]) {
          const hit = await deezerArtist(candidate)
          if (hit) return hit
        }
        return null
      })(),
      wikipedia(a.name),
      spotifyVerified(a.name, a.spotifyUrl),
      appleMusicLink(a.name, a.appleId),
    ])

    // GATE IMAGE : jamais d'ajout sans photo vérifiée (HTTP + content-type).
    let image = (dz?.picture || wiki.image || '').split('?')[0]
    if (image && !(await imageOk(image))) image = ''
    if (!image) {
      console.log(`✗ ${label} — AUCUNE IMAGE VÉRIFIÉE, non ajouté (règle)`)
      report.skipped.push({ name: a.name, reason: 'no-image', deezer: dz?.name ?? null })
      return
    }

    const place = CITIES[a.key]
    const platforms = {}
    if (dz?.link) platforms.deezer = dz.link
    if (apple) platforms.apple_music = apple
    if (spotify) platforms.spotify = spotify

    const payload = {
      id,
      name: a.name,
      genre: a.genre,
      city: place.city,
      district: a.district ?? '',
      birthplace: a.birthplace ?? '',
      country: 'US',
      flag: flagFor('US'),
      lat: place.lat,
      lng: place.lng,
      bio: wiki.bio,
      image,
      followers: dz?.nb_fan ? String(dz.nb_fan) : '',
      source: 'catalog',
      platforms,
      socials: {},
    }

    if (DRY_RUN) {
      console.log(`[dry] ${label} — ${place.city}${a.district ? ` / ${a.district}` : ''} · img ✓ · fans ${dz?.nb_fan ?? '—'}`)
      report.added.push({ id, name: a.name, city: place.city })
      counters.added += 1
      return
    }

    const result = await upsert(payload)
    if (!result.ok) {
      console.log(`✗ ${label} — RPC : ${result.error}`)
      report.errors.push({ name: a.name, error: result.error })
      return
    }
    if (result.updated) {
      counters.enriched += 1
      report.enriched.push({ id, name: a.name })
      console.log(`↻ ${label} — enrichi`)
    } else {
      counters.added += 1
      report.added.push({ id, name: a.name, city: place.city, followers: payload.followers })
      console.log(`✓ ${label} — ${place.city}${a.district ? ` / ${a.district}` : ''} · fans ${dz?.nb_fan?.toLocaleString('fr-FR') ?? '—'} · ${Object.keys(platforms).join('+') || 'sans lien'}`)
    }
  }

  // Pool de workers : 6 artistes en vol (apis publiques le tolèrent largement).
  const CONCURRENCY = 6
  let cursor = 0
  async function worker() {
    while (cursor < ARTISTS.length) {
      const index = cursor++
      try {
        await processOne(ARTISTS[index], index)
      } catch (e) {
        report.errors.push({ name: ARTISTS[index].name, error: e.message })
        console.log(`✗ [${index + 1}] ${ARTISTS[index].name} — ${e.message}`)
      }
      await sleep(60)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  try {
    mkdirSync(path.join(root, '.freebuff'), { recursive: true })
    writeFileSync(path.join(root, '.freebuff', 'populate-san-francisco-report.json'), JSON.stringify(report, null, 2))
  } catch { /* rapport non bloquant */ }

  console.log(`\nTerminé : ${counters.added} ajouté(s), ${counters.enriched} enrichi(s), ${report.skipped.length} ignoré(s), ${report.errors.length} erreur(s).`)
  console.log('Rapport : .freebuff/populate-san-francisco-report.json')
}

main().catch((e) => {
  console.error('Erreur fatale :', e.message)
  process.exit(1)
})
