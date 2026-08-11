/**
 * Agent à outils portable (pattern LangGraph) pour le flow maps.
 *
 * Un agent = un état + des outils + une boucle de décision conditionnelle :
 *   1. SEARCH        → outil `musicbrainz_search` (nom + alias)
 *   2. DETAILS       → outil `musicbrainz_details` (pays, ville, type, tags, liens)
 *   3. VERIFY        → outil `wikidata_entity` (occupations P106 → anti-politicien)
 *   4. ENRICH        → outil `wikipedia_summary` (bio + photo HD) si manquants
 *   5. LOCATE        → outil `geocode` (coordonnées si ville connue)
 *   6. VERDICT IA    → Mistral compare les sources, normalise genre/bio,
 *                      rend keep / review / reject.
 *
 * Le CŒUR de l'agent (outils + boucle) n'utilise que fetch (global) : la même
 * logique est portée dans l'edge function Deno ai_artist_agent (Supabase,
 * prod). Seuls les helpers d'env (loadMapboxToken) sont Node — hors cœur.
 */
import { readFileSync, existsSync } from 'node:fs'
import {
  aiVerifyArtists,
  loadMistralKey,
} from './ai-verify.mjs'

/** Clé Mapbox depuis apps/web/.env.local (helper scripts — hors cœur). */
export function loadMapboxToken(root) {
  try {
    const file = `${root}/apps/web/.env.local`
    if (!existsSync(file)) return null
    const line = readFileSync(file, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('VITE_MAPBOX_TOKEN='))
    return line ? line.split('=')[1].trim().replace(/^["']|["']$/g, '') : null
  } catch {
    return null
  }
}

export const AGENT_UA = 'MusiMaps/1.0 (https://musimaps.app; ai-artist-agent)'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(url, { signal, headers = {}, retries = 2 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': AGENT_UA, ...headers },
      signal,
    })
    if (res.ok) return res.json()
    // MusicBrainz « busy » (503) / quota (429) : attendre et réessayer.
    if ((res.status === 503 || res.status === 429) && attempt < retries) {
      await sleep(2500 * attempt)
      continue
    }
    throw new Error(`HTTP ${res.status} — ${url.slice(0, 90)}`)
  }
  throw new Error(`HTTP échec — ${url.slice(0, 90)}`)
}

function normalize(value) {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/* ---------------------------------------------------------------- */
/* Outils de l'agent                                                */
/* ---------------------------------------------------------------- */

/** Outil : recherche MusicBrainz (artiste + alias). */
async function toolMusicbrainzSearch(name) {
  const term = /[\s-]/.test(name) ? `"${name}"` : name
  const out = []
  for (const field of ['artist', 'alias']) {
    try {
      const data = await getJson(
        `https://musicbrainz.org/ws/2/artist/?query=${field}:${encodeURIComponent(term)}&fmt=json&limit=6`,
      )
      out.push(...(data.artists ?? []))
      await sleep(1100)
    } catch {
      /* source suivante */
    }
    if (out.length >= 5) break
  }
  const seen = new Set()
  return out
    .filter((a) => a.id && !seen.has(a.id) && (seen.add(a.id), true))
    .slice(0, 5)
    .map((a) => ({
      mbid: a.id,
      name: a.name,
      type: a.type,
      disambiguation: a.disambiguation ?? '',
      country: a.country ?? '',
      area: a.area?.name ?? '',
      tags: (a.tags ?? []).map((t) => t.name),
    }))
}

/** Outil : détails complets MusicBrainz (relations, area, genres, tags). */
async function toolMusicbrainzDetails(mbid) {
  try {
    const d = await getJson(
      `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels+area+genres+tags&fmt=json`,
    )
    const relations = d.relations ?? []
    return {
      country: d.country ?? '',
      area: d.area?.name ?? '',
      beginArea: d['begin-area']?.name ?? '',
      type: d.type ?? '',
      tags: [
        ...new Set([
          ...(d.genres ?? []).map((t) => t.name),
          ...(d.tags ?? []).map((t) => t.name),
        ]),
      ],
      relations,
      wikidataUrl: relations.find((r) => r.type === 'wikidata')?.url?.resource ?? null,
    }
  } catch {
    return {}
  }
}

/** Occupations musicales / non musicales (labels anglais Wikidata). */
const MUSIC_OCCUPATIONS =
  /(singer|songwriter|musician|rapper|composer|dj|guitarist|pianist|drummer|saxophonist|vocalist|bandleader|band|record producer|hip hop|producer|music|beatmaker|instrumentalist)/i
const BAD_OCCUPATIONS =
  /(politician|actor|actress|sport|football|basketball|writer|novelist|model|presenter|comedian|businessperson|businessman|entrepreneur|banker|statesperson|official|lawyer|jurist|priest|footballer|athlete)/i

/** Outil : entité Wikidata (occupations P106, pays P27, naissance P19,
    image P18, MBID P434, page Wikipedia). */
async function toolWikidataEntity(wikidataUrl) {
  const qid = (wikidataUrl?.match(/Q\d+/) ?? [])[0]
  if (!qid) return {}
  try {
    const data = await getJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}` +
        `&props=claims%7Csitelinks&sitefilter=enwiki%7Cfrwiki` +
        `&languages=fr%7Cen&format=json&origin=*`,
    )
    const entity = data?.entities?.[qid]
    const claims = entity?.claims ?? {}
    const first = (prop) => {
      for (const c of claims[prop] ?? []) {
        try {
          return c.mainsnak?.datavalue?.value
        } catch {
          /* next */
        }
      }
      return null
    }
    // Occupations (P106) : résolues en labels anglais via le même QID batch.
    const occQids = (claims.P106 ?? [])
      .map((c) => c?.mainsnak?.datavalue?.value?.id ?? '')
      .filter(Boolean)
    let occupations = []
    if (occQids.length > 0) {
      try {
        const labels = await getJson(
          `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${occQids.join('|')}` +
            `&props=labels&languages=en&format=json&origin=*`,
        )
        occupations = occQids
          .map((q) => labels?.entities?.[q]?.labels?.en?.value ?? '')
          .filter(Boolean)
      } catch {
        /* labels indisponibles */
      }
    }
    const country = first('P27') ?? first('P495')
    const image = first('P18')
    const sitelinks = entity?.sitelinks ?? {}
    return {
      occupations,
      countryLabel: typeof country === 'object' ? country?.label ?? '' : '',
      birthplace: typeof first('P19') === 'object' ? first('P19')?.label ?? '' : '',
      image: typeof image === 'string' ? image : '',
      wikipediaTitle: sitelinks?.enwiki?.title ?? sitelinks?.frwiki?.title ?? null,
    }
  } catch {
    return {}
  }
}

/** Outil : résumé Wikipedia (bio + photo HD). */
async function toolWikipediaSummary(title, lang = 'en') {
  try {
    const base = lang === 'fr' ? 'https://fr.wikipedia.org' : 'https://en.wikipedia.org'
    const s = await getJson(`${base}/api/rest_v1/page/summary/${encodeURIComponent(title)}`)
    return {
      bio: (s.extract ?? '').slice(0, 600),
      image: (s.originalimage?.source ?? s.thumbnail?.source ?? '').split('?')[0],
    }
  } catch {
    return { bio: '', image: '' }
  }
}

/** Outil : géocodage Mapbox (coordonnées + pays résolu). */
async function toolGeocode(place, countryCode, mapboxToken) {
  if (!mapboxToken || !place?.trim()) return null
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(place)}.json` +
      `?access_token=${mapboxToken}&limit=1&types=place,region,locality` +
      (countryCode ? `&country=${countryCode}` : '')
    const data = await getJson(url)
    const feature = data?.features?.[0]
    const center = feature?.center
    if (!center || center.length !== 2) return null
    const country = (feature.context ?? [])
      .find((x) => (x.id ?? '').startsWith('country'))?.short_code
    return {
      lng: center[0],
      lat: center[1],
      country: typeof country === 'string' && country.length >= 2
        ? country.slice(0, 2).toUpperCase()
        : countryCode ?? '',
    }
  } catch {
    return null
  }
}

/** Classement des candidats : les plus notables d'abord. */
function pickBest(hits) {
  return [...hits].sort((a, b) => {
    const score = (h) =>
      (h.type === 'Group' ? 1 : 0) + (h.tags.length > 0 ? 1 : 0) - (h.disambiguation ? 2 : 0)
    return score(b) - score(a)
  })[0]
}

/* ---------------------------------------------------------------- */
/* Boucle de l'agent (état + arêtes conditionnelles)                 */
/* ---------------------------------------------------------------- */

/**
 * Lance l'agent de deep-search sur un artiste.
 * Retourne l'état final : { query, candidate, status, verdict, log }.
 * status : 'empty' | 'rejected' | 'done' | 'partial'
 */
export async function runArtistAgent(name, opts = {}) {
  const {
    apiKey,
    mapboxToken,
    maxSteps = 7,
    log = () => {},
  } = opts
  const state = {
    query: name,
    candidate: null,
    status: 'partial',
    verdict: null,
    log: [],
  }
  let steps = 0
  const trace = (msg) => {
    state.log.push(msg)
    log(msg)
  }
  const step = async (fn) => {
    steps += 1
    if (steps > maxSteps) return false
    await fn()
    return true
  }

  // 1. SEARCH
  trace(`  [agent:1/search] musicbrainz_search("${name}")`)
  const hits = await toolMusicbrainzSearch(name)
  if (hits.length === 0) {
    state.status = 'empty'
    trace(`  [agent] ✗ aucun résultat MusicBrainz`)
    return state
  }
  state.candidate = pickBest(hits)

  // 2. DETAILS
  const continueStep = await step(async () => {
    trace(`  [agent:2/details] musicbrainz_details(${state.candidate.mbid})`)
    const details = await toolMusicbrainzDetails(state.candidate.mbid)
    state.candidate = {
      ...state.candidate,
      ...details,
      city: state.candidate.city || details.beginArea || details.area || '',
    }
  })
  if (!continueStep) return state

  // 3. VERIFY (anti-politicien) + pays/naissance/image via Wikidata
  await step(async () => {
    trace(`  [agent:3/verify] wikidata_entity(${state.candidate.wikidataUrl ?? '—'})`)
    const wd = await toolWikidataEntity(state.candidate.wikidataUrl)
    state.candidate.wikidata = wd
    const text = (wd.occupations ?? []).join(' ').toLowerCase()
    if (text) {
      const isMusic = MUSIC_OCCUPATIONS.test(text)
      const isBad = BAD_OCCUPATIONS.test(text)
      if (isBad && !isMusic) {
        state.status = 'rejected'
        state.verdict = {
          verdict: 'reject',
          reason: `Non-musicien (occupations Wikidata : ${(wd.occupations ?? []).join(', ').slice(0, 120)})`,
        }
        trace(`  [agent] ⛔ ${state.candidate.name} — non-musicien`)
      }
    }
    if (!state.candidate.country && wd.countryLabel) state.candidate.country = wd.countryLabel
    if (!state.candidate.city && wd.birthplace) state.candidate.city = wd.birthplace
    if (!state.candidate.image && wd.image) state.candidate.image = wd.image
  })
  if (state.status === 'rejected') return state

  // 4. ENRICH (bio + image Wikipedia) si manquants
  await step(async () => {
    const title = state.candidate.wikidata?.wikipediaTitle
    if (!title || (state.candidate.bio && state.candidate.image)) return
    trace(`  [agent:4/enrich] wikipedia_summary("${title}")`)
    const wiki = await toolWikipediaSummary(title)
    if (wiki.bio && !state.candidate.bio) state.candidate.bio = wiki.bio
    if (wiki.image && !state.candidate.image) state.candidate.image = wiki.image
  })

  // 5. LOCATE (coordonnées si ville connue) — valide aussi la localisation
  await step(async () => {
    if (!state.candidate.city || !mapboxToken) return
    trace(`  [agent:5/locate] geocode("${state.candidate.city}", ${state.candidate.country})`)
    const geo = await toolGeocode(
      [state.candidate.city, state.candidate.country].filter(Boolean).join(', '),
      state.candidate.country,
      mapboxToken,
    )
    if (geo) {
      state.candidate.lat = geo.lat
      state.candidate.lng = geo.lng
      if (geo.country && !state.candidate.country) state.candidate.country = geo.country
    }
  })

  // 6. VERDICT IA final (comparaison multi-sources via Mistral)
  if (apiKey && !state.verdict) {
    try {
      const [result] = await aiVerifyArtists(
        [{
          id: state.candidate.mbid ? `mb-${state.candidate.mbid}` : state.candidate.name,
          name: state.candidate.name,
          genre: state.candidate.tags?.[0] ?? '',
          country: state.candidate.country ?? '',
          city: state.candidate.city ?? '',
          bio: state.candidate.bio ?? '',
          disambiguation: state.candidate.disambiguation ?? '',
          type: state.candidate.type ?? '',
          source: 'musicbrainz',
          links: (state.candidate.relations ?? [])
            .map((r) => r.url?.resource)
            .filter(Boolean)
            .slice(0, 10),
        }],
        { apiKey },
      )
      if (result) {
        state.verdict = result
        if (result.genre) state.candidate.genre = result.genre
        if (result.bio && result.bio.length >= 40) state.candidate.bio = result.bio
        if (result.verdict === 'reject') state.status = 'rejected'
        else state.status = 'done'
      }
    } catch (e) {
      trace(`  [agent] ↻ IA indisponible (${e.message})`)
      state.status = state.candidate.bio ? 'done' : 'partial'
    }
  } else if (!state.verdict) {
    state.status = state.candidate.bio ? 'done' : 'partial'
  }

  return state
}

export { loadMistralKey }
