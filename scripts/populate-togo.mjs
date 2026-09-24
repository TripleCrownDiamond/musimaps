#!/usr/bin/env node
/**
 * Peuplement « scène togolaise » de la carte Musimaps.
 *
 * Même moteur et mêmes règles que populate-benin.mjs : Deezer (photo HD,
 * fans, lien), iTunes (lien Apple Music), Spotify oEmbed (URL artiste),
 * Wikipédia (bio) — JAMAIS d'ajout sans image vérifiée, JAMAIS de lien non
 * confirmé par une API. Villes : uniquement les villes documentées (Tsévié,
 * Vogan, Atakpamé, Kara, Aného, Tabligbo, Togoville, Dapaong, Sokodé…) ;
 * les artistes sans ville précise vont à Lomé, capitale et centre de gravité
 * de la scène. id tg-<slug>, country TG.
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
const UA = 'MusiMaps/1.0 (https://musimaps.com; togo curation script)'
const DRY_RUN = process.argv.includes('--dry-run')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ---------------------------------------------------------------- */
/* Données : 100 artistes togolais (Vaudou Game déjà en base)       */
/* ---------------------------------------------------------------- */
const CITIES = {
  LOM: { city: 'Lomé', lat: 6.1319, lng: 1.2228 },
  TSE: { city: 'Tsévié', lat: 6.4264, lng: 1.2131 },
  VOG: { city: 'Vogan', lat: 6.4167, lng: 1.5333 },
  ATA: { city: 'Atakpamé', lat: 7.5333, lng: 1.1333 },
  KAR: { city: 'Kara', lat: 9.5511, lng: 1.1861 },
  ANE: { city: 'Aného', lat: 6.2333, lng: 1.6 },
  TAB: { city: 'Tabligbo', lat: 6.5833, lng: 1.5 },
  TOG: { city: 'Togoville', lat: 6.25, lng: 1.4833 },
  DAP: { city: 'Dapaong', lat: 10.8622, lng: 0.2078 },
  SOK: { city: 'Sokodé', lat: 8.9833, lng: 1.1333 },
}

const ARTISTS = [
  { name: 'Toofan', key: 'LOM', genre: 'Afropop / Cool Catché' },
  { name: 'Santrinos Raphaël', key: 'LOM', genre: 'Afro-R&B / Afropop' },
  { name: 'King Mensah', key: 'LOM', genre: 'Traditionnel / Afropop' },
  { name: 'Bella Bellow', key: 'TSE', genre: 'Musique africaine / Blues' },
  { name: 'Jimi Hope', key: 'LOM', genre: 'Rock / Afro-rock' },
  { name: 'Afia Mala', key: 'VOG', genre: 'World / Traditionnel' },
  { name: 'Fifi Rafiatou', key: 'ATA', genre: 'Afro-zouk / Salsa / Reggae' },
  { name: 'Nimon Toki Lala', key: 'KAR', genre: 'Soukous / Rumba / Traditionnel' },
  { name: 'Akofa Akoussa', key: 'LOM', genre: 'Traditionnel / Variété' },
  { name: 'Monia Tchangai', key: 'LOM', genre: 'Musique togolaise' },
  { name: 'Yta Jourias', key: 'LOM', genre: 'Traditionnel / Variété' },
  { name: 'Agboti Yao', key: 'LOM', genre: 'Sogo / Traditionnel' },
  { name: 'Roger Damawuzan', key: 'LOM', genre: 'Afro-funk / Soul' },
  { name: 'Peter Solo', key: 'ANE', genre: 'Afro-funk / Vaudou' },
  { name: 'Amen Viana', key: 'LOM', genre: 'Afro-rock / Funk / Blues' },
  { name: 'Vaudou Game', key: 'LOM', genre: 'Vaudou Funk / Afro-funk', enrichOnly: true },
  { name: 'Nana Benz du Togo', key: 'LOM', genre: 'Digital Vaudou / Electro' },
  { name: 'Elom 20ce', key: 'LOM', genre: 'Hip-hop / Rap' },
  { name: "ARKA'N", key: 'LOM', genre: 'Metal / Rock africain' },
  { name: 'Togo All Stars', key: 'LOM', genre: 'Afro-funk / Highlife' },
  { name: 'Orchestre Abass', key: 'LOM', genre: 'Afro-funk / Afrobeat' },
  { name: 'Dogo du Togo', key: 'LOM', genre: 'Afropop / World' },
  { name: 'Black Manu', key: 'LOM', genre: 'Afro / World' },
  { name: 'Tabi Bonney', key: 'LOM', genre: 'Hip-hop / Rap' },
  { name: 'Vanessa Worou', key: 'LOM', genre: 'World / Afro-pop' },
  { name: 'Almok', key: 'LOM', genre: 'R&B / Afropop' },
  { name: 'Senzaa', key: 'LOM', genre: 'Afrobeat / Afro-soul / Dancehall' },
  { name: 'Ralycia', key: 'KAR', genre: 'R&B / Musique urbaine' },
  { name: 'Noire Velours', key: 'LOM', genre: 'Afro-soul / Urbain' },
  { name: 'Lauraa', key: 'LOM', genre: 'Rap / Musique urbaine' },
  { name: 'Mic Flammez', key: 'LOM', genre: 'Rap / Hip-hop' },
  { name: 'Sethlo', key: 'LOM', genre: 'Afropop / Afro-urbain' },
  { name: 'Kiko', key: 'LOM', genre: 'Pop / R&B' },
  { name: 'Tony X', key: 'LOM', genre: 'Afro-urbain / Afropop' },
  { name: 'Pikaluz', key: 'LOM', genre: 'Rap / Hip-hop' },
  { name: 'Peewii', key: 'LOM', genre: 'Rap / Afro-urbain' },
  { name: 'Etane Blex', key: 'LOM', genre: 'Afropop / Afrobeat' },
  { name: 'Willy Baby', key: 'LOM', genre: 'Rap / Afropop' },
  { name: 'J-Gado', key: 'LOM', genre: 'Hip-hop / Afropop' },
  { name: 'Ghettovi', key: 'ATA', district: 'Datcha', genre: 'Rap hardcore / Hip-hop' },
  { name: 'Juliano', key: 'LOM', genre: 'Rap / Hip-hop' },
  { name: 'Yaovi Kheteti', key: 'VOG', genre: 'Rap / Highlife / Afrobeat' },
  { name: 'Fofo Skarfo', key: 'LOM', district: 'Ahligo', genre: 'Rap / Afrobeat / R&B' },
  { name: 'R-Venio', key: 'LOM', genre: 'Afro-urbain' },
  { name: 'El Miliaro', key: 'LOM', genre: 'Rap / Urbain' },
  { name: 'Emorej', key: 'LOM', genre: 'Gospel / Afro-urbain' },
  { name: 'Shad', key: 'LOM', genre: 'Afropop / Urbain' },
  { name: 'Sly Feel', key: 'LOM', genre: 'Musique urbaine' },
  { name: 'Pheno Ambro', key: 'LOM', genre: 'Afro / Urbain' },
  { name: 'Yaka Crazy', key: 'LOM', genre: 'Rap / Afro-urbain' },
  { name: 'LePapara', key: 'LOM', genre: 'Musique urbaine' },
  { name: 'Dieudonné Wila', key: 'LOM', genre: 'Afropop' },
  { name: 'Talakaka On The Flow', key: 'LOM', genre: 'Rap / Hip-hop' },
  { name: 'Beatpopovelo', key: 'LOM', genre: 'Drill / Rap' },
  { name: 'King Bala', key: 'LOM', genre: 'Afro-urbain' },
  { name: 'MrKing', key: 'LOM', genre: 'Afro / Urbain' },
  { name: 'Black T', key: 'LOM', genre: 'Afropop / Azonto', aliases: ['Blackt Igwe', 'Black T Togo'] },
  { name: 'Zaga Bambo', key: 'LOM', genre: 'Dancehall / Afropop' },
  { name: 'Boris Ket', key: 'LOM', genre: 'Soul / Afro-zouk / Afrobeat' },
  { name: 'Kollins Dream Face', key: 'LOM', genre: 'Afropop / Afrobeats' },
  { name: 'Paki Chenzu', key: 'LOM', genre: 'Drill / Rap / Afrobeat' },
  { name: 'Manu Keresy', key: 'LOM', genre: 'R&B / Afropop' },
  { name: 'Wedy', key: 'LOM', district: 'Bè', genre: 'R&B / Afropop / Zouk' },
  { name: 'Omar B', key: 'LOM', genre: 'R&B / Soul' },
  { name: 'Eric MC', key: 'LOM', genre: 'Rap / Hip-hop' },
  { name: 'Ali Jezz', key: 'LOM', genre: 'Rap / Hip-hop' },
  { name: "Kossi Ape'son", key: 'LOM', genre: 'Afropop / Traditionnel' },
  { name: 'Master Popa', key: 'LOM', genre: 'Afropop / Azonto' },
  { name: 'KanAa', key: 'LOM', genre: 'Rap / Hip-hop' },
  { name: 'Prince Mo', key: 'LOM', genre: 'Fusion / Hip-hop' },
  { name: 'DJ Mohab', key: 'LOM', genre: 'Cool Catché / Afro' },
  { name: '109 Connexion', key: 'LOM', genre: 'Cool Catché / Afropop' },
  { name: 'Ricky Mo', key: 'LOM', genre: 'Afropop / R&B' },
  { name: 'Jad Fozis', key: 'LOM', genre: 'Reggae' },
  { name: 'Eugène Ablodévi', key: 'LOM', genre: 'Afro / Traditionnel' },
  { name: 'Kang D Dreama', key: 'LOM', genre: 'Afropop / R&B' },
  { name: "King'S", key: 'LOM', genre: 'Afropop / R&B' },
  { name: "Charles O'zzo", key: 'LOM', genre: 'Afropop / Variété' },
  { name: 'Mr Kurones', key: 'LOM', genre: 'Afrobeat / Rap / R&B', birthplace: 'Dapaong' },
  { name: 'Winiga', key: 'LOM', genre: 'Afropop' },
  { name: 'Hira', key: 'LOM', genre: 'Afropop / R&B' },
  { name: 'Alister G', key: 'LOM', genre: 'Soul / Afro / R&B' },
  { name: 'Afaz Folly', key: 'LOM', genre: 'R&B' },
  { name: 'Fuga Boy', key: 'LOM', genre: 'Rap' },
  { name: 'Cyntish', key: 'LOM', genre: 'Rap' },
  { name: 'Merveil Doussiema', key: 'LOM', genre: 'Gospel' },
  { name: 'King Nasrod', key: 'LOM', genre: 'Afrotem / Afropop' },
  { name: 'Akadi', key: 'LOM', genre: 'Afro-moderne / Traditionnel' },
  { name: 'Foly Nédy', key: 'LOM', genre: 'Jazz / Afro-fusion' },
  { name: 'Lakoélé', key: 'LOM', genre: 'Jazz / Afro-fusion' },
  { name: 'Nayo', key: 'LOM', genre: 'Jazz / Afro-fusion' },
  { name: 'Lomé Orchestra', key: 'LOM', genre: 'Jazz / Afro-fusion' },
  { name: 'Zangbéto Trio', key: 'LOM', genre: 'Traditionnel / Jazz' },
  { name: 'Blakiti', key: 'LOM', genre: 'Jazz / Afro-fusion' },
  { name: 'Kale Brass Band', key: 'LOM', genre: 'Brass / Jazz' },
  { name: 'MGG Brass Band', key: 'LOM', genre: 'Brass / Jazz' },
  { name: 'Oyem Odjo', key: 'TAB', genre: 'Rap / Slam' },
  { name: 'King Ghetto Mike', key: 'TOG', genre: 'Rap / Afrobeat' },
  { name: 'MC Too', key: 'DAP', genre: 'Afro-décalé / Moba / Afro-trap' },
  { name: 'Achi Déba', key: 'SOK', genre: 'Salsa / Afro / Guitare' },
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
    let results = await search(name)
    let pool = results.filter((a) => normalize(a.name) === nName)
    if (pool.length === 0) {
      // Repli : « <nom> benin » quand Deezer nomme l'artiste avec le pays.
      results = await search(`${name} benin`)
      pool = results.filter((a) => {
        const an = normalize(a.name)
        return (an.includes(nName) || nName.includes(an)) && an.length <= nName.length + 6
      })
    }
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

  console.log(`Peuplement Togo — ${ARTISTS.length} entrées${DRY_RUN ? ' (DRY RUN)' : ''}\n`)
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
    const id = a.enrichOnly ? existing.id : `tg-${slugify(a.name)}`

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
      // Ville de naissance documentée ≠ ville du pin (Blaaz : né à Kano…).
      birthplace: a.birthplace ?? '',
      country: 'TG',
      flag: flagFor('TG'),
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
    writeFileSync(path.join(root, '.freebuff', 'populate-togo-report.json'), JSON.stringify(report, null, 2))
  } catch { /* rapport non bloquant */ }

  console.log(`\nTerminé : ${counters.added} ajouté(s), ${counters.enriched} enrichi(s), ${report.skipped.length} ignoré(s), ${report.errors.length} erreur(s).`)
  console.log('Rapport : .freebuff/populate-togo-report.json')
}

main().catch((e) => {
  console.error('Erreur fatale :', e.message)
  process.exit(1)
})
