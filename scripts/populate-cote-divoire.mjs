#!/usr/bin/env node
/**
 * Peuplement « scène ivoirienne » de la carte Musimaps.
 *
 * Même moteur et mêmes règles que populate-benin.mjs : Deezer (photo HD,
 * fans, lien), iTunes (lien Apple Music), Spotify oEmbed (URL artiste),
 * Wikipédia (bio) — JAMAIS d'ajout sans image vérifiée, JAMAIS de lien non
 * confirmé par une API. Villes : uniquement les villes documentées (Dimbokro, Odienné,
 * Grand-Bassam, Man, Divo, Daloa, Lakota, Agboville, Béoumi, Tabou, Bouaké,
 * Sakassou…) et les districts d'Abidjan (Cocody, Yopougon, Marcory,
 * Koumassi, Treichville, Port-Bouët, Adjamé, Anoumabo). Les trois artistes
 * sans ville précise (?) vont à Abidjan, centre de gravité de la scène.
 * id ci-<slug>, country CI.
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
/* Données : 100 artistes ivoiriens (5 déjà en base → enrichis)     */
/* ---------------------------------------------------------------- */
const CITIES = {
  ABI: { city: 'Abidjan', lat: 5.3599, lng: -4.0083 },
  DIM: { city: 'Dimbokro', lat: 6.6469, lng: -4.4683 },
  ODI: { city: 'Odienné', lat: 9.5053, lng: -7.5633 },
  GBA: { city: 'Grand-Bassam', lat: 5.2, lng: -3.7333 },
  MAN: { city: 'Man', lat: 7.4122, lng: -7.5533 },
  DIV: { city: 'Divo', lat: 5.8375, lng: -5.3572 },
  DAL: { city: 'Daloa', lat: 6.8776, lng: -6.4503 },
  LAK: { city: 'Lakota', lat: 5.9333, lng: -5.6833 },
  AGB: { city: 'Agboville', lat: 5.9333, lng: -4.2167 },
  BEO: { city: 'Béoumi', lat: 7.6667, lng: -5.5833 },
  TAB: { city: 'Tabou', lat: 4.4167, lng: -7.35 },
  BOU: { city: 'Bouaké', lat: 7.6906, lng: -5.0333 },
  SAK: { city: 'Sakassou', lat: 6.9333, lng: -5.2167 },
}

const ARTISTS = [
  { name: 'Alpha Blondy', key: 'DIM', genre: 'Reggae' },
  { name: 'Tiken Jah Fakoly', key: 'ODI', genre: 'Reggae' },
  { name: 'Magic System', key: 'ABI', district: 'Anoumabo', genre: 'Zouglou / Pop', enrichOnly: true },
  { name: 'Meiway', key: 'GBA', genre: 'Zoblazo', enrichOnly: true },
  { name: 'DJ Arafat', key: 'ABI', genre: 'Coupé-décalé', enrichOnly: true },
  { name: 'Serge Beynaud', key: 'ABI', genre: 'Coupé-décalé / Afropop' },
  { name: 'Debordo Leekunfa', key: 'ABI', genre: 'Coupé-décalé' },
  { name: 'Kerozen', key: 'ABI', district: 'Yopougon', genre: 'Coupé-décalé / Afropop' },
  { name: 'Bebi Philip', key: 'ABI', genre: 'Coupé-décalé', enrichOnly: true },
  { name: 'Molare', key: 'ABI', genre: 'Coupé-décalé' },
  { name: 'Douk Saga', key: 'ABI', genre: 'Coupé-décalé' },
  { name: 'Lino Versace', key: 'SAK', genre: 'Coupé-décalé' },
  { name: 'Boro Sanguy', key: 'ABI', genre: 'Coupé-décalé' },
  { name: 'DJ Jacob', key: 'ABI', genre: 'Coupé-décalé' },
  { name: 'DJ Caloudji', key: 'ABI', genre: 'Coupé-décalé' },
  { name: 'Erickson Le Zulu', key: 'ABI', genre: 'Coupé-décalé' },
  { name: 'Claire Bahi', key: 'ABI', genre: 'Coupé-décalé / Gospel' },
  { name: 'Kedjevara', key: 'ABI', genre: 'Coupé-décalé' },
  { name: 'Ariel Sheney', key: 'ABI', genre: 'Coupé-décalé / Afropop' },
  { name: 'Mix Premier', key: 'ABI', genre: 'Coupé-décalé' },
  { name: 'Safarel Obiang', key: 'ABI', genre: 'Coupé-décalé / Afro' },
  { name: 'Vitale', key: 'ABI', genre: 'Coupé-décalé' },
  { name: 'Rocky Gold', key: 'ABI', genre: 'Coupé-décalé / Afropop' },
  { name: 'Josey', key: 'ABI', genre: 'Afro-zouk / R&B / Afro-folk', enrichOnly: true },
  { name: 'Roseline Layo', key: 'MAN', genre: 'Zouglou / Afropop' },
  { name: 'Didi B', key: 'ABI', genre: 'Rap / Hip-hop / Afropop' },
  { name: 'Himra', key: 'ABI', district: 'Cocody', genre: 'Drill / Rap hardcore' },
  { name: 'Suspect 95', key: 'ABI', genre: 'Rap / Hip-hop' },
  { name: 'Fior 2 Bior', key: 'ABI', genre: 'Rap / Nouchi' },
  { name: 'Shado Chris', key: 'ABI', genre: 'Rap / Afro-urbain' },
  { name: 'Kiff No Beat', key: 'ABI', genre: 'Rap / Dirty Décalé' },
  { name: 'Black K', key: 'ABI', genre: 'Rap' },
  { name: "Elow'n", key: 'ABI', genre: 'Rap / Afropop', aliases: ['Elown', 'Elow N'] },
  { name: 'Eljay', key: 'ABI', genre: 'Rap' },
  { name: 'Joochar', key: 'ABI', genre: 'Rap' },
  { name: 'Widgunz', key: 'ABI', genre: 'Trap / Hip-hop' },
  { name: 'Lesky', key: 'ABI', genre: 'Rap / Trap' },
  { name: 'Kadja', key: 'ABI', district: 'Cocody', genre: 'Rap hardcore / Trap', aliases: ['Kadja 302'] },
  { name: 'Mosty', key: 'ABI', district: 'Port-Bouët', genre: 'Rap / Trap / Afropop' },
  { name: 'Jeune Lion', key: 'ABI', district: 'Marcory', genre: 'Rap / Trap / Afro-urban' },
  { name: 'Nash', key: 'ABI', genre: 'Rap / Hip-hop' },
  { name: 'Billy Billy', key: 'ABI', genre: 'Rap / Hip-hop' },
  { name: 'Tam Sir', key: 'ABI', genre: 'Afrobeat / Hip-hop / Zouglou' },
  { name: 'Team Paiya', key: 'ABI', genre: 'Maimouna / Afro-urbain' },
  { name: 'Ste Milano', key: 'ABI', genre: 'Rap / Afro-urbain', aliases: ['Ste Milano', 'Sté Milano'] },
  { name: 'Renard Barakissa', key: 'ABI', genre: 'Afro-urbain' },
  { name: 'Tazeboy', key: 'ABI', genre: 'Afro-urbain' },
  { name: 'PSK', key: 'ABI', genre: 'Rap / Afro-urbain' },
  { name: 'KS Bloom', key: 'ABI', district: 'Yopougon', genre: 'Rap Gospel / Afropop' },
  { name: 'Morijah', key: 'ABI', district: 'Adjamé', genre: 'Gospel / R&B / Afrobeats' },
  { name: 'Yodé & Siro', key: 'ABI', genre: 'Zouglou', aliases: ['Yode & Siro', 'Yode et Siro'] },
  { name: 'Espoir 2000', key: 'ABI', district: 'Koumassi', genre: 'Zouglou' },
  { name: 'Les Patrons', key: 'ABI', genre: 'Zouglou' },
  { name: 'Petit Denis', key: 'ABI', district: 'Gbatanikro', genre: 'Zouglou' },
  { name: 'Les Garagistes', key: 'ABI', genre: 'Zouglou' },
  { name: "Les Marabouts d'Afrique", key: 'ABI', genre: 'Zouglou', aliases: ['Les Marabouts Afrique'] },
  { name: 'Révolution', key: 'ABI', genre: 'Zouglou', aliases: ['Revolution Zouglou'] },
  { name: 'Zouglou Makers', key: 'ABI', genre: 'Zouglou' },
  { name: 'Yabongo Lova', key: 'ABI', genre: 'Zouglou' },
  { name: 'Molière', key: 'ABI', genre: 'Zouglou', aliases: ['Moliere Zouglou'] },
  { name: 'Fitini', key: 'ABI', genre: 'Zouglou' },
  { name: 'Les Surchocs', key: 'ABI', district: 'Treichville', genre: 'Zouglou' },
  { name: 'Les Salopards', key: 'ABI', genre: 'Zouglou' },
  { name: 'Système Gazeur', key: 'ABI', genre: 'Zouglou', aliases: ['Systeme Gazeur'] },
  { name: 'Esprit de Yop', key: 'ABI', district: 'Yopougon', genre: 'Zouglou' },
  { name: 'Les Potes de la Rue', key: 'ABI', genre: 'Zouglou' },
  { name: 'Didier Bilé', key: 'ABI', district: 'Yopougon', genre: 'Zouglou', aliases: ['Les Parents du Campus', 'Parents du Campus'] },
  { name: 'Magic Diesel', key: 'ABI', genre: 'Zouglou' },
  { name: 'Samy Succès', key: 'ABI', genre: 'Zouglou', aliases: ['Samy Succes'] },
  { name: 'JC Pluriel', key: 'ABI', genre: 'Zouglou' },
  { name: "Isaïe L'Original", key: 'ABI', genre: 'Zouglou', aliases: ['Isaie Original', "Isaie l'Original"] },
  { name: 'Les Leaders', key: 'ABI', genre: 'Zouglou' },
  { name: 'Soum Bill', key: 'ABI', genre: 'Zouglou' },
  { name: 'Dezy Champion', key: 'ABI', genre: 'Zouglou / Gospel' },
  { name: 'Atito Kpata', key: 'ABI', genre: 'Zouglou' },
  { name: 'Les Mercenaires', key: 'ABI', genre: 'Zouglou' },
  { name: 'Les Poussins Chocs', key: 'ABI', district: 'Treichville', genre: 'Zouglou' },
  { name: 'VDA', key: 'ABI', genre: 'Zouglou' },
  { name: 'Garba 50', key: 'ABI', genre: 'Zouglou' },
  { name: 'Tour 2 Garde', key: 'ABI', genre: 'Afropop / Rap' },
  { name: 'Dobet Gnahoré', key: 'DIV', district: 'Kragbalilié', genre: 'Afro-pop / World' },
  { name: 'Manou Gallo', key: 'DIV', genre: 'Afro-groove / World' },
  { name: 'Ernesto Djédjé', key: 'DAL', district: 'Tahiraguhé', genre: 'Ziglibithy / Afro-funk' },
  { name: 'François Lougah', key: 'LAK', genre: 'Soul / Variété ivoirienne' },
  { name: 'Bailly Spinto', key: 'ABI', district: 'Treichville', genre: 'Slow / Soul / Variété' },
  { name: 'Aïcha Koné', key: 'ABI', genre: 'Mandingue / Variété', birthplace: 'Gbon' },
  { name: 'Reine Pélagie', key: 'DAL', genre: 'Ziglibithy' },
  { name: 'Nayanka Bell', key: 'AGB', genre: 'Afrobeat / World' },
  { name: 'Monique Séka', key: 'ABI', genre: 'Afro-zouk' },
  { name: 'Antoinette Konan', key: 'BEO', genre: 'Ahoco / Tradi-moderne' },
  { name: 'Chantal Taïba', key: 'TAB', genre: 'Matiko / Tradi-moderne' },
  { name: 'Mathey', key: 'ABI', genre: 'Afro-zouk' },
  { name: 'Joëlle Séka', key: 'ABI', genre: 'Afro / Zouk' },
  { name: 'Affou Kéïta', key: 'ODI', genre: 'Mandingue' },
  { name: 'Ismaël Isaac', key: 'ABI', genre: 'Reggae', birthplace: 'Boundiali' },
  { name: 'Serges Kassy', key: 'ABI', district: 'Treichville', genre: 'Reggae' },
  { name: 'Luckson Padaud', key: 'DAL', district: 'Tahiraguhé', genre: 'Laba-Laba / Tradi-moderne' },
  { name: 'Paco Séry', key: 'DIV', genre: 'Jazz fusion / World' },
  { name: "O'Nel Mala", key: 'MAN', district: 'Logoualé', genre: 'Gospel / World' },
  { name: 'Constance Aman', key: 'BOU', genre: 'Gospel' },
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

  console.log(`Peuplement Côte d'Ivoire — ${ARTISTS.length} entrées${DRY_RUN ? ' (DRY RUN)' : ''}\n`)
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
    const id = a.enrichOnly ? existing.id : `ci-${slugify(a.name)}`

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
      country: 'CI',
      flag: flagFor('CI'),
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
    writeFileSync(path.join(root, '.freebuff', 'populate-civ-report.json'), JSON.stringify(report, null, 2))
  } catch { /* rapport non bloquant */ }

  console.log(`\nTerminé : ${counters.added} ajouté(s), ${counters.enriched} enrichi(s), ${report.skipped.length} ignoré(s), ${report.errors.length} erreur(s).`)
  console.log('Rapport : .freebuff/populate-civ-report.json')
}

main().catch((e) => {
  console.error('Erreur fatale :', e.message)
  process.exit(1)
})
