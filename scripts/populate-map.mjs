#!/usr/bin/env node
/**
 * Peuplement automatique de la carte via MusicBrainz (Brainz).
 *
 * Pour chaque ville ciblée, le script :
 *   1. Cherche la zone MusicBrainz de la ville (area:« ville ») ;
 *   2. Moissonne les artistes de cette zone (musicien·nes vérifié·es via
 *      Wikidata — anti-politiciens/acteurs) ;
 *   3. Récupère une vraie bio + photo HD via Wikipedia ;
 *   4. Géocode la ville via Mapbox ;
 *   5. Upsert chaque artiste via le RPC add_or_update_map_artist (aucune
 *      clé service requise) et déclenche notify_discovery.
 *
 * Périodicité : à lancer via cron, ex. chaque nuit :
 *   0 3 * * * cd /d/musimaps && node scripts/populate-map.mjs --batch 25
 *
 * Usage :
 *   node scripts/populate-map.mjs                # villes par défaut, 15 max
 *   node scripts/populate-map.mjs --city Paris   # une ville précise
 *   node scripts/populate-map.mjs --cities "Lagos,Paris,Nairobi"
 *   node scripts/populate-map.mjs --limit 5      # max par ville
 *   node scripts/populate-map.mjs --dry-run      # affiche sans écrire
 *   node scripts/populate-map.mjs --reset-state  # re-traite tout
 */
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { aiVerifyArtists, loadMistralKey } from './lib/ai-verify.mjs'
import { runArtistAgent } from './lib/ai-agent.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/* ---------------------------------------------------------------- */
/* Env (Supabase + Mapbox)                                          */
/* ---------------------------------------------------------------- */
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

const USER_AGENT = 'MusiMaps/1.0 (https://musimaps.app; map population script)'

/* ---------------------------------------------------------------- */
/* Argv                                                             */
/* ---------------------------------------------------------------- */
function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback
}
const hasFlag = (name) => process.argv.includes(`--${name}`)

const DRY_RUN = hasFlag('dry-run')
// Vérification IA (--ai) : Mistral confirme que chaque candidat est bien un
// artiste musical et normalise genre/bio AVANT l'ajout (anti-politiciens,
// anti-labels, genres propres). Nécessite MISTRAL_API_KEY dans le .env racine.
const AI_VERIFY = hasFlag('ai')
const AI_KEY = loadMistralKey(root)
if (AI_VERIFY && !AI_KEY) {
  console.warn('⚠️  --ai demandé mais MISTRAL_API_KEY absente du .env racine — peuplement SANS vérification IA.')
}
// --agent : deep-search de l'agent (Wikidata/Wikipedia) pour les candidats
// sans bio ni photo — les « lacunes » de MusicBrainz.
const AGENT_DEEP = hasFlag('agent')
const LIMIT_PER_CITY = Math.max(1, parseInt(arg('limit', '40'), 10) || 40)
const BATCH_TOTAL = parseInt(arg('batch', '0'), 10) || 0 // 0 = pas de limite
const REQUEST_DELAY = parseInt(arg('delay', '1100'), 10) || 1100 // MusicBrainz : ≥ 1 s

// Gate de popularité Deezer : on ne garde que des artistes VRAIMENT
// populaires (nb_fan >= --min-fans, défaut 10 000), avec image HD et sons
// vérifiés (top tracks non vide). `--no-fans` désactive tout le gate.
const MIN_FANS = parseInt(arg('min-fans', '10000'), 10) || 10000
const FANS_GATE = !hasFlag('no-fans')

// Villes par défaut : capitales / scènes musicales majeures, avec un fort
// accent sur les scènes africaines et francophones (cœur du produit).
const DEFAULT_CITIES = [
  // Afrique de l'Ouest & centrale
  'Abidjan', 'Dakar', 'Lagos', 'Accra', 'Cotonou', 'Ouagadougou', 'Bamako',
  'Conakry', 'Lomé', 'Niamey', 'Kinshasa', 'Brazzaville', 'Yaoundé', 'Douala',
  'Libreville', 'N’Djamena', 'Kano', 'Ibadan', 'Port Harcourt', 'Kumasi',
  'Freetown', 'Monrovia', 'Nouakchott',
  // Afrique de l'Est & australe
  'Nairobi', 'Kampala', 'Dar es Salaam', 'Addis Ababa', 'Kigali',
  'Johannesburg', 'Cape Town', 'Durban', 'Maputo', 'Luanda', 'Harare',
  'Lusaka', 'Antananarivo',
  // Afrique du Nord
  'Casablanca', 'Algiers', 'Tunis', 'Cairo', 'Tripoli',
  // Europe
  'Paris', 'London', 'Marseille', 'Lyon', 'Brussels', 'Berlin', 'Amsterdam',
  'Barcelona', 'Madrid', 'Lisbon', 'Milan', 'Rome', 'Vienna', 'Stockholm',
  'Oslo', 'Copenhagen', 'Zurich', 'Hamburg', 'Munich', 'Brussels',
  // Amériques
  'New York', 'Los Angeles', 'Atlanta', 'Miami', 'Houston', 'Chicago',
  'Toronto', 'Montreal', 'São Paulo', 'Rio de Janeiro', 'Mexico City',
  'Kingston', 'Bogotá', 'Lima', 'Buenos Aires', 'Port-au-Prince', 'Havana',
  'San Juan', 'Santo Domingo', 'Panama City', 'Medellín',
  // Asie / Océanie
  'Tokyo', 'Seoul', 'Mumbai', 'Lagos', 'Sydney', 'Melbourne', 'Auckland',
  'Jakarta', 'Manila', 'Bangkok', 'Delhi', 'Dubai',
]
const rawCities = arg('city', null)
  ? [arg('city', null)]
  : arg('cities', null)
    ? arg('cities', null).split(',').map((s) => s.trim()).filter(Boolean)
    : DEFAULT_CITIES

/* ---------------------------------------------------------------- */
/* État de progression (reprise + anti-doublons)                    */
/* ---------------------------------------------------------------- */
const STATE_FILE = path.join(root, '.freebuff', 'populate-map-state.json')
function loadState() {
  if (hasFlag('reset-state')) return { cities: {}, artists: {} }
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return { cities: {}, artists: {} }
  }
}
function saveState(state) {
  try {
    mkdirSync(path.dirname(STATE_FILE), { recursive: true })
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  } catch {
    /* état non persistant : on continue sans */
  }
}

/* ---------------------------------------------------------------- */
/* Helpers réseau                                                   */
/* ---------------------------------------------------------------- */
async function getJson(fetchUrl, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 4
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await fetch(fetchUrl, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT, ...opts.headers },
      signal: opts.signal,
    })
    if (res.ok) return res.json()
    // 503 / 429 : MusicBrainz « busy » ou quota — attendre et réessayer.
    if ((res.status === 503 || res.status === 429) && attempt < maxAttempts) {
      const backoff = 2500 * attempt
      console.log(`    ↻ HTTP ${res.status} — retry ${attempt}/${maxAttempts} (${backoff / 1000}s)`)
      await sleep(backoff)
      continue
    }
    throw new Error(`HTTP ${res.status} — ${fetchUrl.slice(0, 90)}`)
  }
  throw new Error(`HTTP échec — ${fetchUrl.slice(0, 90)}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function normalize(value) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
const flagFor = (cc) => {
  if (!cc || cc.length !== 2) return '🌍'
  const base = 0x1f1e6
  return String.fromCodePoint(base + cc.charCodeAt(0) - 65, base + cc.charCodeAt(1) - 65)
}

/*
 * Choisit un genre lisible depuis les tags MusicBrainz : on préfère les
 * genres « scène » connus (afrobeats, amapiano, coupé-décalé…) puis un
 * genre générique (rap, soul, rock…), puis le premier tag propre.
 */
const GENRE_PRIORITY = [
  /afrobeats|afrobeat/i, /amapiano/i, /coupé-décalé|coupe decale|zouglou/i,
  /ndombolo|soukous|rumba/i, /highlife/i, /reggae|dancehall|ska/i,
  /rap|hip.?hop|trap|drill|grime/i, /soul|r.?&.?b|funk/i,
  /gospel/i, /salsa|samba|reggaeton|cumbia/i, /zouk|compas/i,
  /rock|metal|punk/i, /pop|k.?pop|j.?pop/i, /jazz|blues/i,
  /electronic|house|techno|edm|dubstep/i, /folk|country|indie/i,
]
function pickGenre(tags) {
  const clean = (tags ?? []).filter((t) => t && !/^\d+$/.test(t) && t.length > 2)
  if (clean.length === 0) return ''
  for (const re of GENRE_PRIORITY) {
    const hit = clean.find((t) => re.test(t))
    if (hit) return hit
  }
  return clean[0]
}

/* Occupations considérées comme « musicien » (labels anglais Wikidata). */
const MUSIC_OCCUPATIONS = /(singer|songwriter|musician|rapper|composer|dj|guitarist|pianist|drummer|saxophonist|vocalist|bandleader|band|record producer|hip hop|producer|music)/i
const BAD_OCCUPATIONS = /(politician|actor|actress|sport|football|basketball|writer|novelist|model|presenter|comedian|businessperson|businessman|entrepreneur|banker|statesperson|official|lawyer|jurist|priest)/i

// Cache QID → label anglais (les occupations reviennent sans cesse).
const occupationLabelCache = new Map()
async function occupationLabels(qids) {
  const fresh = qids.filter((q) => !occupationLabelCache.has(q))
  if (fresh.length > 0) {
    try {
      const data = await getJson(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${fresh.join('|')}` +
          `&props=labels&languages=en&format=json&origin=*`,
      )
      for (const q of fresh) {
        occupationLabelCache.set(q, data?.entities?.[q]?.labels?.en?.value ?? '')
      }
    } catch {
      for (const q of fresh) occupationLabelCache.set(q, '')
    }
  }
  return qids.map((q) => occupationLabelCache.get(q) ?? '')
}

/* ---------------------------------------------------------------- */
/* 1. Zone MusicBrainz d'une ville                                  */
/* ---------------------------------------------------------------- */
async function findAreaId(city) {
  const data = await getJson(
    `https://musicbrainz.org/ws/2/area/?query=area:${encodeURIComponent(`"${city}"`)}&fmt=json&limit=3`,
  )
  const area = (data.areas ?? []).find(
    (a) => a.type === 'City' && normalize(a.name) === normalize(city),
  ) ?? data.areas?.[0]
  return area?.id ?? null
}

/* ---------------------------------------------------------------- */
/* 2. Artistes de la zone + filtre musicien (Wikidata)              */
/* ---------------------------------------------------------------- */
const KEEP_TYPES = new Set(['Person', 'Group'])

async function fetchAreaArtists(areaId, city) {
  // Endpoint browse (la recherche Lucene ne supporte pas area:<uuid>).
  // Moissonne jusqu'à 6 pages de 100 → 600 candidats max par ville.
  const artists = []
  for (let offset = 0; offset < 600; offset += 100) {
    // inc=genres+tags+url-rels : nécessaire pour le genre et le filtre
    // musicien (Wikidata) en aval. `inc=counts` n'est pas supporté en browse.
    const url =
      `https://musicbrainz.org/ws/2/artist?area=${areaId}&fmt=json&limit=100&offset=${offset}` +
      `&inc=genres+tags+url-rels`
    const data = await getJson(url)
    const page = (data.artists ?? []).filter((a) => KEEP_TYPES.has(a.type))
    artists.push(...page)
    // Browse n'expose pas le total : une page < 100 = fin de liste.
    if (page.length < 100) break
    await sleep(REQUEST_DELAY)
  }
  return artists.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    tags: [...new Set([...(a.genres ?? []).map((t) => t.name), ...(a.tags ?? []).map((t) => t.name)])],
    disambiguation: a.disambiguation ?? '',
    country: a.country ?? '',
    area: a.area?.name ?? city,
    begin: a['life-span']?.begin ?? null,
    relations: (a.relations ?? []).map((r) => ({ type: r.type, url: r.url?.resource ?? '' })),
  }))
}

/** Tri les candidats : les plus notables d'abord (Wikidata, genres, nom propre). */
function rankCandidates(candidates) {
  return [...candidates]
    .map((c) => {
      let score = 0
      if (c.relations.some((r) => r.type === 'wikidata')) score += 6
      if (c.tags.length > 0) score += 3
      if (c.begin) score += 2
      if (c.type === 'Group') score += 1
      if (!c.disambiguation) score += 1
      if (/\d/.test(c.name)) score -= 1 // noms à numéros = souvent des démos
      if (c.disambiguation) score -= 2
      return { ...c, score }
    })
    .sort((a, b) => b.score - a.score)
}

/** Vérifie que l'entité est bien un artiste musical via Wikidata. */
async function isMusician(wikidataUrl) {
  if (!wikidataUrl) return true // sans lien Wikidata, on garde (source MusicBrainz)
  const qid = (wikidataUrl.match(/Q\d+/) ?? [])[0]
  if (!qid) return true
  try {
    const data = await getJson(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${qid}&property=P106&format=json&origin=*`,
    )
    const qids = (data?.claims?.P106 ?? [])
      .map((c) => c?.mainsnak?.datavalue?.value?.id ?? '')
      .filter(Boolean)
    if (qids.length === 0) return true // pas d'occupation renseignée
    const labels = await occupationLabels(qids)
    const text = labels.join(' ')
    if (BAD_OCCUPATIONS.test(text) && !MUSIC_OCCUPATIONS.test(text)) return false
    return MUSIC_OCCUPATIONS.test(text)
  } catch {
    return true
  }
}

/* ---------------------------------------------------------------- */
/* 3. Bio + image Wikipedia (via Wikidata QID si dispo)             */
/* ---------------------------------------------------------------- */
async function wikipediaTitleFromWikidata(wikiUrl) {
  // wikiUrl ressemble à https://www.wikidata.org/wiki/Q12345
  const qid = (wikiUrl?.match(/Q\d+/) ?? [])[0]
  if (!qid) return null
  try {
    const data = await getJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}` +
        `&props=sitelinks&sitefilter=enwiki%7Cfrwiki&format=json&origin=*`,
    )
    const links = data?.entities?.[qid]?.sitelinks ?? {}
    return links?.enwiki?.title ?? links?.frwiki?.title ?? null
  } catch {
    return null
  }
}

async function fetchWikipediaSummary(title, lang = 'en') {
  const base = lang === 'fr' ? 'https://fr.wikipedia.org' : 'https://en.wikipedia.org'
  const summary = await getJson(
    `${base}/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
  )
  const image = summary?.originalimage?.source ?? summary?.thumbnail?.source ?? ''
  const extract = summary?.extract ?? ''
  return { bio: extract.slice(0, 400), image: image ? image.split('?')[0] : '' }
}

/** Recherche Wikipedia : titre exact d'abord, puis recherche, sur en + fr. */
async function wikipediaBioAndImage(name, wikiUrl) {
  try {
    // 1. Chemin fiable : QID Wikidata → titre exact (en, puis fr).
    const title = await wikipediaTitleFromWikidata(wikiUrl)
    if (title) {
      try {
        return await fetchWikipediaSummary(title, 'en')
      } catch {
        return await fetchWikipediaSummary(title, 'fr')
      }
    }
    // 2. Titre direct (nom exact de l'artiste).
    const direct = name.replace(/ /g, '_')
    try {
      return await fetchWikipediaSummary(direct, 'en')
    } catch {
      /* pas de page enwiki → recherche */
    }
    // 3. Recherche floue avec guillemets (en, puis fr).
    for (const lang of ['en', 'fr']) {
      try {
        const base = lang === 'fr' ? 'fr.wikipedia.org' : 'en.wikipedia.org'
        const q = encodeURIComponent(`"${name}"`)
        const search = await getJson(
          `https://${base}/w/api.php?action=query&generator=search&gsrsearch=${q}` +
            `&gsrlimit=10&prop=pageprops%7Cinfo&format=json&origin=*`,
        )
        const pages = Object.values(search?.query?.pages ?? {})
        const nName = normalize(name)
        // On n'accepte QUE les pages dont le titre correspond au nom de
        // l'artiste (exact ou inclus) — sinon on passe à la langue suivante
        // plutôt que de prendre un candidat générique (label, festival…).
        const candidate =
          pages.find(
            (p) =>
              p.title &&
              !p.pageprops?.disambiguation &&
              normalize(p.title) === nName,
          ) ??
          pages.find(
            (p) =>
              p.title &&
              !p.pageprops?.disambiguation &&
              normalize(p.title).includes(nName) &&
              nName.length > 4,
          )
        if (!candidate?.title) continue
        return await fetchWikipediaSummary(candidate.title, lang)
      } catch {
        /* langue suivante */
      }
    }
    return { bio: '', image: '' }
  } catch {
    return { bio: '', image: '' }
  }
}

/* ---------------------------------------------------------------- */
/* 4. Deezer — popularité, image HD, sons (gate « artistes populaires ») */
/* ---------------------------------------------------------------- */
/**
 * Cherche l'artiste sur Deezer et renvoie { id, nb_fan, picture } si le nom
 * correspond exactement (normalisé), sinon null. Deezer est la source de
 * popularité la plus simple sans clé : nb_fan = nombre de fans réel.
 */
async function deezerArtist(name) {
  try {
    const data = await getJson(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=10`,
    )
    const results = (data?.data ?? []).filter((a) => a?.name && a?.id)
    if (results.length === 0) return null
    const nName = normalize(name)
    // 1. Correspondance exacte (normalisée) — on garde celle avec le PLUS de
    //    fans (Deezer renvoie souvent le vrai artiste ET un homonyme :
    //    « Youssou N'dour » 55 fans vs « Youssou N'Dour » 210 k — il ne faut
    //    jamais prendre le premier venu).
    const exact = results.filter((a) => normalize(a.name) === nName)
    const pool = exact.length > 0 ? exact : results.filter((a) => {
      const an = normalize(a.name)
      return nName.includes(an) || an.includes(nName)
    })
    const hit = (pool.length > 0 ? pool : results).reduce(
      (best, a) => ((a.nb_fan ?? 0) > (best?.nb_fan ?? -1) ? a : best),
      null,
    )
    if (!hit) return null
    return {
      id: hit.id,
      nb_fan: hit.nb_fan ?? 0,
      picture: hit.picture_xl || hit.picture_big || '',
      name: hit.name,
    }
  } catch {
    return null
  }
}

/** Vérifie que l'artiste a de vrais morceaux (top tracks non vide). */
async function deezerHasTracks(id) {
  try {
    const data = await getJson(`https://api.deezer.com/artist/${id}/top?limit=1`)
    return (data?.data?.length ?? 0) > 0
  } catch {
    return false
  }
}

/* ---------------------------------------------------------------- */
/* 5. Géocodage Mapbox                                               */
/* ---------------------------------------------------------------- */
async function geocodeCity(city) {
  if (!mapboxToken) return null
  try {
    // types=place : on ne géocode que des VILLES, jamais un pays seul
    // (sinon « Guinée » renvoie la Guinée équatoriale, « Canada » un centroïde).
    const data = await getJson(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(city)}.json` +
        `?access_token=${mapboxToken}&limit=1&types=place,locality`,
    )
    const center = data?.features?.[0]?.center
    return center && center.length === 2 ? center : null
  } catch {
    return null
  }
}

/* ---------------------------------------------------------------- */
/* 6. Upsert + notif                                                 */
/* ---------------------------------------------------------------- */
async function upsertArtist(artist) {
  const res = await fetch(`${api}/rpc/add_or_update_map_artist`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_artist: artist }),
  })
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
  const body = await res.json().catch(() => null)
  if (!body?.ok) return { ok: false, error: body?.error ?? 'rpc error' }
  const updated = body.updated === true

  // Notifie uniquement les NOUVEAUX artistes (jamais les mises à jour —
  // éviter le spam de notifications à chaque run cron).
  if (!updated) {
    try {
      await fetch(`${api}/rpc/notify_discovery`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          p_artist_id: artist.id,
          p_artist_name: artist.name,
          p_genre: artist.genre ?? '',
          p_city: artist.city ?? '',
          p_country: artist.country ?? '',
        }),
      })
    } catch {
      /* silencieux */
    }
  }
  return { ok: true, updated }
}

/* ---------------------------------------------------------------- */
/* Main                                                             */
/* ---------------------------------------------------------------- */
async function processCity(city, state, runTotal = 0) {
  const key = normalize(city)
  // On re-parcourt TOUJOURS les villes (peuplement périodique) ; la dédupe
  // par MBID (state.artists) empêche les doublons. state.cities = historique.

  const coords = await geocodeCity(city)
  if (!coords) {
    console.log(`  ✗ ${city} : géocodage impossible`)
    state.cities[key] = 'no-geocode'
    return { added: 0 }
  }
  const [lng, lat] = coords

  const areaId = await findAreaId(city)
  if (!areaId) {
    console.log(`  ✗ ${city} : zone MusicBrainz introuvable`)
    state.cities[key] = 'no-area'
    return { added: 0 }
  }
  await sleep(REQUEST_DELAY)

  let candidates = []
  try {
    candidates = await fetchAreaArtists(areaId, city)
  } catch (e) {
    console.log(`  ✗ ${city} : ${e.message}`)
    state.cities[key] = 'error'
    return { added: 0 }
  }
  candidates = rankCandidates(candidates)

  let added = 0
  let skipped = 0
  for (const cand of candidates) {
    if (BATCH_TOTAL > 0 && runTotal + added >= BATCH_TOTAL) break
    if (added + skipped >= LIMIT_PER_CITY) break
    // Dédupe par MBID : déjà ajouté lors d'un run précédent → on l'ignore
    // (l'upsert RPC enrichit de toute façon les artistes déjà en base).
    if (state.artists[cand.id] && !hasFlag('refresh-updates')) {
      skipped += 1
      continue
    }

    // Filtre musicien via Wikidata (repose sur url-rels de MusicBrainz).
    const wikiUrl = cand.relations.find((r) => r.type === 'wikidata')?.url ?? null
    await sleep(REQUEST_DELAY)
    const musician = await isMusician(wikiUrl)
    if (!musician) {
      skipped += 1
      console.log(`  ~ ${cand.name} (${city}) — non-musicien, ignoré`)
      continue
    }
    // Sans lien Wikidata, on garde si l'artiste a un genre musical taggé
    // (les « vrais » artistes locaux sans page Wikipedia ont presque toujours
    // des tags genre) OU si --keep-unverified est passé. Un artiste sans
    // genre ET sans lien Wikidata est très probablement un profil parasite
    // (politicien, personnalité, label) → on l'ignore.
    const hasGenreTag = cand.tags.some((t) =>
      /rap|hip|afrobeats|afrobeat|reggae|dancehall|soul|r&b|rnb|rock|pop|jazz|blues|gospel|zouk|coupé|ndombolo|amapiano|highlife|country|folk|techno|house|electronic|metal|punk|classical|opera|samba|reggaeton|trap|drill|grime|k-pop|j-pop|indie|singer|songwriter/i.test(t),
    )
    if (!wikiUrl && !hasGenreTag && !hasFlag('keep-unverified')) {
      skipped += 1
      continue
    }

    // Gate de popularité Deezer : uniquement des artistes populaires
    // (nb_fan >= --min-fans, défaut 10 000), avec une photo HD et de vrais
    // morceaux (top tracks). Les candidats sans présence Deezer notable sont
    // des artistes de niche → ignorés, on garde la carte « grand public ».
    let deezer = null
    if (FANS_GATE) {
      await sleep(500)
      deezer = await deezerArtist(cand.name)
      if (!deezer) {
        skipped += 1
        console.log(`  ~ ${cand.name} (${city}) — introuvable sur Deezer, ignoré`)
        continue
      }
      if (deezer.nb_fan < MIN_FANS) {
        skipped += 1
        console.log(`  ~ ${cand.name} (${city}) — ${deezer.nb_fan.toLocaleString('fr-FR')} fans < ${MIN_FANS.toLocaleString('fr-FR')}, pas assez populaire`)
        continue
      }
      await sleep(500)
      const hasTracks = await deezerHasTracks(deezer.id)
      if (!hasTracks) {
        skipped += 1
        console.log(`  ~ ${cand.name} (${city}) — aucun morceau vérifié sur Deezer, ignoré`)
        continue
      }
    }

    await sleep(REQUEST_DELAY)
    const { bio, image } = await wikipediaBioAndImage(cand.name, wikiUrl)
    // --agent : quand Wikipedia n'a rien donné (aucune page), l'agent à
    // outils creuse (Wikidata → titre → bio/photo) avant d'ajouter.
    if (AGENT_DEEP && (!bio || !image)) {
      try {
        const agentState = await runArtistAgent(cand.name, {
          apiKey: AI_KEY || undefined,
          mapboxToken,
          maxSteps: 6,
          log: () => {},
        })
        const ac = agentState.candidate
        // Garde d'homonymie : on ne copie bio/photo QUE si l'agent a trouvé
        // le MÊME artiste (sinon on risquerait de coller le profil d'un
        // homonyme sur le candidat en cours d'ajout).
        if (ac?.bio && !bio && normalize(ac.name) === normalize(cand.name)) bio = ac.bio
        if (ac?.image && !image && normalize(ac.name) === normalize(cand.name)) image = ac.image
      } catch {
        /* l'agent est optionnel */
      }
    }
    const genre = pickGenre(cand.tags)
    const country = cand.country || ''
    // Photo HD : la photo Wikipedia (vraie photo) est préférée ; sinon la
    // photo Deezer (toujours dispo en 1000×1000) sert de repli fiable.
    const finalImage = image || deezer?.picture || ''
    const artistPayload = {
      id: `mb-${cand.id}`,
      name: cand.name,
      genre,
      city,
      country,
      flag: flagFor(country),
      lat,
      lng,
      // bio vide = laisser la valeur existante (jamais de placeholder).
      bio,
      image: finalImage,
      // Popularité réelle (Deezer) : alimente l'anneau de popularité, les
      // stats de cluster et le tri des résultats (parité web + mobile).
      followers: deezer ? String(deezer.nb_fan) : '',
      source: 'musicbrainz',
      platforms: {},
      socials: {},
    }

    // Vérification IA (--ai) : filtre intelligent sur les sources croisées.
    // Un « reject » (politicien, acteur, label…) est ignoré ; un « review »
    // est ajouté mais l'admin peut le revoir ; genre et bio sont normalisés.
    if (AI_VERIFY && AI_KEY) {
      try {
        const [verdict] = await aiVerifyArtists(
          [{
            id: artistPayload.id,
            name: artistPayload.name,
            genre: artistPayload.genre,
            country: artistPayload.country,
            city: artistPayload.city,
            bio: artistPayload.bio,
            source: artistPayload.source,
          }],
          { apiKey: AI_KEY },
        )
        if (verdict?.verdict === 'reject') {
          skipped += 1
          console.log(`  ⛔ ${cand.name} — non-musicien (IA) : ${verdict.reason}`)
          continue
        }
        if (verdict?.genre) artistPayload.genre = verdict.genre
        if (verdict?.bio && verdict.bio.length >= 40) artistPayload.bio = verdict.bio
        if (verdict?.verdict === 'review') {
          console.log(`  ⚠️  ${cand.name} — à vérifier (IA) : ${verdict.reason}`)
        }
      } catch (e) {
        console.log(`    ↻ IA indisponible (${e.message}) — ajout sans vérification`)
      }
    }

    if (DRY_RUN) {
      // Ne PAS marquer state.artists en dry-run : la simulation ne doit pas
      // faire croire au prochain run réel que l'artiste est déjà traité.
      console.log(`  [dry] ${cand.name} (${city}) — ${genre || 'genre inconnu'}`)
      added += 1
      continue
    }

    const result = await upsertArtist(artistPayload)
    if (result.ok) {
      console.log(`  ✓ ${cand.name} (${city})${result.updated ? ' — mis à jour' : ''}`)
      added += 1
      state.artists[cand.id] = true
    } else {
      console.log(`  ✗ ${cand.name} : ${result.error}`)
      skipped += 1
    }
  }

  state.cities[key] = `${added} ajouté(s), ${skipped} ignoré(s)`
  return { added }
}

async function main() {
  console.log(`Peuplement de la carte via MusicBrainz${DRY_RUN ? ' (DRY RUN)' : ''}`)
  console.log(`Villes : ${rawCities.length} · max ${LIMIT_PER_CITY}/ville${BATCH_TOTAL ? ` · batch ${BATCH_TOTAL}` : ''}\n`)

  const state = loadState()
  state.totalAdded = state.totalAdded ?? 0
  let total = 0

  for (const city of rawCities) {
    console.log(`\n— ${city} —`)
    const { added } = await processCity(city, state, total)
    total += added
    state.totalAdded += added
    if (!DRY_RUN) saveState(state)
  }

  console.log(`\nTerminé : ${total} artiste(s) ajouté(s)${DRY_RUN ? ' (simulation)' : ''}.`)
  console.log(`État sauvegardé : ${STATE_FILE}`)
}

main().catch((e) => {
  console.error('Erreur fatale :', e.message)
  process.exit(1)
})
