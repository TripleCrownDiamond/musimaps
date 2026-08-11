import { supabase, hasSupabase } from './supabase'
import type { Artist, ArtistEvent } from '@musimaps/shared'
import { countryByName } from '@musimaps/shared'

/**
 * MusicBrainz exige un User-Agent descriptif (identification du client) :
 * les agents génériques ou vides sont rejetés (HTTP 503).
 */
const MUSICBRAINZ_USER_AGENT =
  'Musimaps/1.0 (https://musimaps.app)'

/** Plateformes d'écoute publiques d'un artiste. */
export type ArtistPlatforms = Partial<
  Record<'youtube' | 'spotify' | 'apple_music' | 'bandcamp' | 'soundcloud' | 'deezer' | 'website', string>
>

/** Réseaux sociaux d'un artiste. */
export type ArtistSocials = Partial<
  Record<'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'wikipedia', string>
>

/** Artiste trouvé en ligne (MusicBrainz), prêt à être ajouté à la carte. */
export interface DiscoveredArtist {
  id: string
  name: string
  genre: string
  city: string
  /** Quartier / district (ex. « Yopougon », « Bastille ») — ancre le pin
   *  dans le vrai quartier et disperse les artistes d'une même ville. */
  district?: string
  country: string
  flag: string
  lat: number
  lng: number
  bio: string
  image?: string
  source: string
  platforms: ArtistPlatforms
  socials: ArtistSocials
  verified?: boolean
  claimedBy?: string | null
  /** 'Person' (solo) ou 'Group' — distinction artiste / groupe. */
  type?: string
  /** Dates de concert (animations des pins en tournée sur le globe). */
  events?: ArtistEvent[]
  /** Popularité externe (fans Deezer) — anneau + stats de cluster. */
  followers?: string
}

/** Couleur par défaut pour un artiste découvert (aucune identité visuelle). */
const DEFAULT_COLOR: [string, string] = ['#65D8D0', '#167A93']

/** Convertit un pays ISO-3166 en emoji drapeau. */
function flagFor(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) return '🌍'
  const base = 0x1f1e6
  return String.fromCodePoint(
    base + countryCode.charCodeAt(0) - 65,
    base + countryCode.charCodeAt(1) - 65,
  )
}

/**
 * Normalise un pays (nom, code, variantes) en code ISO 3166-1 alpha-2.
 * « Bénin » → BJ, « Guinée » → GN, « RDC » → CD, « Porto Alegre » → null.
 * Retourne null si aucun code fiable ne peut être déduit. S'appuie sur le
 * dataset mondial partagé (packages/shared/src/geo.ts) : tous les pays ISO
 * et leurs noms FR/EN sont reconnus, plus quelques variantes courantes.
 */
function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = String(raw).trim()
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase()
  // Dataset partagé : code, nom FR, nom EN (insensible aux accents/casse).
  const byName = countryByName(s)
  if (byName) return byName.code
  const variants: Record<string, string> = {
    'cote d ivoire': 'CI', 'cote divoire': 'CI', 'ivoire coast': 'CI',
    'republique democratique du congo': 'CD', rdc: 'CD', 'congo dr': 'CD', 'dr congo': 'CD',
    'etats unis': 'US', 'united states': 'US', usa: 'US', 'u s a': 'US',
    'royaume uni': 'GB', 'united kingdom': 'GB', angleterre: 'GB',
    'cap vert': 'CV', 'pays bas': 'NL', 'coree du sud': 'KR', 'coree du nord': 'KP',
    'emirats arabes unis': 'AE', 'arabie saoudite': 'SA',
  }
  const strip = (v: string) =>
    v
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const k = strip(s)
  if (variants[k]) return variants[k]
  return null
}

/** Code pays du contexte d'un résultat Mapbox (short_code « bj », « fr-75 »…). */
function countryCodeOfFeature(feature: { context?: Array<{ id?: string; short_code?: string }> }): string | null {
  const c = (feature.context ?? []).find((x) => (x.id ?? '').startsWith('country'))
  const sc = c?.short_code ?? ''
  const code = sc.replace(/^[a-z]{2}-/, '').toUpperCase()
  return code.length === 2 ? code : null
}

interface MbArtist {
  id: string
  name: string
  /** 'Person' ou 'Group' — distinction artiste solo / groupe. */
  type?: string
  /** Code ISO du pays (FR, NG…) — la source la plus fiable de MusicBrainz. */
  country?: string
  /** Zone actuelle (pays ou ville déclarée par MusicBrainz). */
  area?: { id?: string; name?: string }
  /** Zone d'origine (ville de naissance / formation du groupe). */
  'begin-area'?: { id?: string; name?: string }
  tags?: Array<{ name: string }>
  'life-span'?: { begin?: string; end?: string }
  disambiguation?: string
  relations?: Array<{ type?: string; url?: { resource?: string } }>
}

/** Délai entre deux requêtes MusicBrainz (1 requête/sec autorisée),
    annulable dès que la recherche est remplacée (abort signal). */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve()
    const timer = setTimeout(() => resolve(), ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/** Extrait les plateformes et réseaux sociaux depuis les relations d'un artiste. */
function extractLinks(item: MbArtist): {
  platforms: ArtistPlatforms
  socials: ArtistSocials
  wikipediaUrl?: string
  wikidataId?: string
} {
  const platforms: ArtistPlatforms = {}
  const socials: ArtistSocials = {}
  let wikipediaUrl: string | undefined
  let wikidataId: string | undefined
  for (const rel of item.relations ?? []) {
    const url = rel.url?.resource
    if (!url) continue
    const type = (rel.type ?? '').toLowerCase()
    if (type.includes('youtube')) platforms.youtube = url
    else if (type.includes('spotify')) platforms.spotify = url
    else if (type.includes('apple')) platforms.apple_music = url
    else if (type.includes('bandcamp')) platforms.bandcamp = url
    else if (type.includes('soundcloud')) platforms.soundcloud = url
    else if (type.includes('deezer')) platforms.deezer = url
    else if (type.includes('official homepage')) platforms.website = url
    else if (type.includes('facebook')) socials.facebook = url
    else if (type.includes('instagram')) socials.instagram = url
    else if (type.includes('twitter') || type.includes('x.com')) socials.twitter = url
    else if (type.includes('tiktok')) socials.tiktok = url
    else if (type.includes('wikipedia')) {
      socials.wikipedia = url
      wikipediaUrl = url
    }
    // Wikidata → permet de résoudre la page Wikipedia pour la vraie bio.
    else if (type.includes('wikidata') && /wiki\/Q\d+/.test(url)) {
      wikidataId = url.split('/wiki/')[1]?.split('#')[0]
    }
  }
  return { platforms, socials, wikipediaUrl, wikidataId }
}

/**
 * Résout la vraie bio depuis Wikidata : sitelinks → titre Wikipedia EN → résumé.
 */
async function wikipediaFromWikidata(
  wikidataId: string,
): Promise<{ bio: string; image: string }> {
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=sitelinks&sitefilter=enwiki|frwiki&format=json&origin=*`,
    )
    if (!res.ok) return { bio: '', image: '' }
    const data = (await res.json()) as {
      entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>
    }
    const links = data.entities?.[wikidataId]?.sitelinks
    const title = links?.enwiki?.title ?? links?.frwiki?.title
    if (!title) return { bio: '', image: '' }
    const summary = await fetchWikipediaSummary(title)
    return {
      bio: (summary?.extract ?? '').trim().slice(0, 500),
      image: summary?.image ?? '',
    }
  } catch {
    return { bio: '', image: '' }
  }
}

/** Récupère la vraie bio + photo HD depuis Wikipedia (résumé de la page). */
async function fetchWikipediaBio(
  wikipediaUrl: string,
): Promise<{ bio: string; image: string }> {
  try {
    const title = wikipediaUrl.split('/wiki/')[1]?.split('#')[0]
    if (!title) return { bio: '', image: '' }
    const summary = await fetchWikipediaSummary(title)
    return {
      bio: (summary?.extract ?? '').trim().slice(0, 500),
      image: summary?.image ?? '',
    }
  } catch {
    return { bio: '', image: '' }
  }
}

/** Détails d'un artiste : relations (plateformes, sociaux), zone d'origine
    (begin-area → ville de naissance) + type (person/group). */
async function enrichArtist(
  mbid: string,
  signal?: AbortSignal,
): Promise<{
  relations?: MbArtist['relations']
  type?: string
  area?: MbArtist['area']
  'begin-area'?: MbArtist['begin-area']
  country?: string
  'life-span'?: MbArtist['life-span']
}> {
  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels+area&fmt=json`,
      { headers: { Accept: 'application/json', 'User-Agent': MUSICBRAINZ_USER_AGENT }, signal },
    )
    if (!res.ok) return {}
    const data = (await res.json()) as MbArtist
    return {
      relations: data.relations,
      type: data.type,
      area: data.area,
      'begin-area': data['begin-area'],
      country: data.country,
      'life-span': data['life-span'],
    }
  } catch {
    return {}
  }
}

// ------------------------------------------------------------------
// Recherche multi-sources : MusicBrainz d'abord, puis Wikipedia + Wikidata
// pour les artistes absents de MusicBrainz (mais présents ailleurs).
// ------------------------------------------------------------------

/** Nettoie un titre Wikipedia (« Booba (rapper) » → « Booba »). */
function cleanWikiTitle(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/**
 * Normalise un genre brut (tag MusicBrainz, description Wikipedia) en un
 * genre propre et lisible : « French rapper and singer (born 1976) » → « Rap ».
 * La liste couvre les styles les plus courants, avec priorité au premier match.
 */
const GENRE_RULES: Array<{ re: RegExp; genre: string }> = [
  { re: /amapiano/i, genre: 'Amapiano' },
  { re: /afrobeat|afrobeats|afro-beat/i, genre: 'Afrobeats' },
  { re: /hip[-\s]?hop|rapper|rap\.?|gangsta/i, genre: 'Rap' },
  { re: /dancehall|reggaeton|dembow/i, genre: 'Dancehall' },
  { re: /reggae|ska/i, genre: 'Reggae' },
  { re: /r&?b|soul|neo[-\s]?soul|rnb/i, genre: 'R&B / Soul' },
  { re: /jazz|fusion/i, genre: 'Jazz' },
  { re: /blues/i, genre: 'Blues' },
  { re: /gospel/i, genre: 'Gospel' },
  { re: /folk|singer-?songwriter|chanson/i, genre: 'Folk' },
  { re: /country/i, genre: 'Country' },
  { re: /rock|metal|punk|grunge|indie/i, genre: 'Rock' },
  { re: /electronica|electronic|edm|electro/i, genre: 'Electro' },
  { re: /house/i, genre: 'House' },
  { re: /techno|trance/i, genre: 'Techno' },
  { re: /k-?pop/i, genre: 'K-Pop' },
  { re: /latino|latina|reggaeton/i, genre: 'Latino' },
  { re: /salsa|merengue|bachata|cumbia/i, genre: 'Latino' },
  { re: /zouk|coupe[-\s]decale|coupé[-\s]décalé/i, genre: 'Zouk / Coupé-décalé' },
  { re: /rumba|soukous|ndombolo|afro[-\s]?pop|lingala/i, genre: 'Afro-pop' },
  { re: /highlife/i, genre: 'Highlife' },
  { re: /funk|disco/i, genre: 'Funk' },
  { re: /pop/i, genre: 'Pop' },
  { re: /classical|opera|orchestra/i, genre: 'Classique' },
  { re: /experimental|avant[-\s]?garde/i, genre: 'Expérimental' },
]

/** Nationalités / adjectifs de pays : pas des genres. */
const NATIONALITY_RE =
  /^(american|british|english|french|german|italian|spanish|portuguese|brazilian|jamaican|japanese|korean|chinese|indian|nigerian|senegalese|ivoirien|belgian|swiss|dutch|canadian|mexican|argentine|colombian|cuban|maroccan|algerian|tunisian|congolese|latvian|estonian|lithuanian|polish|russian|ukrainian|turkish|swedish|norwegian|danish|finnish|australian|new zealander|south african|ghanian|kenyan|ethiopian|egyptian|lebanese|israeli|iranian|pakistani|indonesian|filipino|thai|vietnamese|uk)$/i

/** Convertit un genre brut (phrase, description, tag) en genre propre. */
function cleanGenre(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  if (!value || /^unknown/i.test(value)) return 'Unknown'
  for (const { re, genre } of GENRE_RULES) {
    if (re.test(value)) return genre
  }
  // Un adjectif de nationalité seul (« American ») n'est pas un genre.
  if (NATIONALITY_RE.test(value.trim())) return 'International'
  // Repli : premier mot, sans parenthèses ni parenthèses de date.
  const cleaned = value.replace(/\([^)]*\)/g, '').trim()
  const firstWord = cleaned.split(/[\s,;]+/)[0]
  if (firstWord) return firstWord.charAt(0).toUpperCase() + firstWord.slice(1)
  return value
}

/** Enlève les paramètres de suivi (?utm_source=...) des URLs d'images. */
function cleanImageUrl(url: string): string {
  return url.split('?')[0]
}

/** Suffixes de titres qui ne sont manifestement pas un artiste. */
const NON_PERSON_SUFFIX =
  /\((tv series|film|video game|album|song|single|ep|mixtape|book|novel|character|episode|magazine|show|channel|company|record label)\)$/i

/** Entrées MusicBrainz parasites (profils techniques, inconnus…). */
const JUNK_MB_NAME = /^\[.*\]$|^unknown(\s|$)|^various artists$/i

/** Types Wikidata de GROUPES musicaux (instance of, P31) — toujours des artistes. */
const MUSICAL_GROUP_TYPES = new Set([
  'Q215380', // groupe musical
  'Q1407351', // groupe (musique)
  'Q2088357', // artiste musical (peut être une personne)
])

/** Occupations musicales (P106) qui prouvent qu'un humain est un artiste. */
const MUSIC_OCCUPATIONS = new Set([
  'Q639669', // musicien/musicienne
  'Q483501', // chanteur/chanteuse
  'Q2252262', // rappeur/rappeuse
  'Q177220', // auteur-compositeur
  'Q36834', // compositeur
  'Q753110', // auteur-compositeur-interprète
  'Q205985', // guitariste
  'Q855091', // batteur
  'Q1289525', // pianiste
  'Q4610556', // saxophoniste
  'Q10816969', // DJ
  'Q183945', // producteur de disques
  'Q16934228', // percussionniste
  'Q13391348', // bassiste
])

interface WikipediaPage {
  title: string
  qid: string
}

/** Cherche des pages Wikipedia avec leur ID Wikidata, sans les homonymies. */
async function searchWikipediaPages(
  query: string,
  signal?: AbortSignal,
): Promise<WikipediaPage[]> {
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&generator=search` +
      `&gsrsearch=${encodeURIComponent(query)}&gsrlimit=10` +
      `&prop=pageprops%7Cinfo&format=json&origin=*`
    const res = await fetch(url, { signal })
    if (!res.ok) return []
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; pageprops?: { disambiguation?: string; wikibase_item?: string } }
        >
      }
    }
    return Object.values(data.query?.pages ?? {})
      .filter((p) => p.title && p.pageprops?.wikibase_item && !p.pageprops.disambiguation)
      .map((p) => ({ title: p.title as string, qid: p.pageprops?.wikibase_item as string }))
  } catch {
    return []
  }
}

/** Cherche directement sur Wikidata (artistes sans page Wikipedia). */
async function searchWikidataEntities(
  query: string,
  signal?: AbortSignal,
): Promise<WikipediaPage[]> {
  try {
    const url =
      `https://www.wikidata.org/w/api.php?action=wbsearchentities` +
      `&search=${encodeURIComponent(query)}&language=fr&uselang=fr&type=item` +
      `&limit=5&format=json&origin=*`
    const res = await fetch(url, { signal })
    if (!res.ok) return []
    const data = (await res.json()) as {
      search?: Array<{ id?: string; label?: string }>
    }
    return (data.search ?? [])
      .filter((e) => e.id?.startsWith('Q') && e.label)
      .map((e) => ({ title: e.label as string, qid: e.id as string }))
      .slice(0, 5)
  } catch {
    return []
  }
}

/** Résout l'identifiant Wikidata (QID) d'une page Wikipedia (via pageprops). */
async function resolveWikidataId(
  wikipediaUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const title = wikipediaUrl.split('/wiki/')[1]?.split('#')[0]
    if (!title) return null
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops` +
      `&ppprop=wikibase_item&titles=${encodeURIComponent(title)}&format=json&origin=*`
    const res = await fetch(url, { signal })
    if (!res.ok) return null
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> }
    }
    for (const page of Object.values(data.query?.pages ?? {})) {
      const qid = page.pageprops?.wikibase_item
      if (qid) return qid
    }
    return null
  } catch {
    return null
  }
}

/** Résumé Wikipedia (extrait + description + photo HD) d'une page. */
async function fetchWikipediaSummary(
  title: string,
  signal?: AbortSignal,
): Promise<{ extract?: string; description?: string; image?: string } | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { headers: { Accept: 'application/json' }, signal },
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      extract?: string
      description?: string
      originalimage?: { source?: string }
      thumbnail?: { source?: string }
    }
    // originalimage = version HD ; thumbnail = repli (petit aperçu).
    const image = data.originalimage?.source ?? data.thumbnail?.source
    return { extract: data.extract, description: data.description, image: image ? cleanImageUrl(image) : '' }
  } catch {
    return null
  }
}

/** Liens, réseaux, pays, MBID et type d'une entité depuis ses claims Wikidata. */
async function fetchWikidataArtist(
  qid: string,
  signal?: AbortSignal,
): Promise<{
  platforms: ArtistPlatforms
  socials: ArtistSocials
  countryQid?: string
  mbid?: string
  isArtist: boolean
}> {
  try {
    const url =
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}` +
      `&props=claims&format=json&origin=*`
    const res = await fetch(url, { signal })
    if (!res.ok) return { platforms: {}, socials: {}, isArtist: false }
    const data = (await res.json()) as {
      entities?: Record<string, { claims?: Record<string, unknown[]> }>
    }
    const claims = data.entities?.[qid]?.claims ?? {}
    const val = (prop: string): unknown => {
      for (const c of claims[prop] ?? []) {
        try {
          const claim = c as { mainsnak?: { datavalue?: { value?: unknown } } }
          return claim.mainsnak?.datavalue?.value
        } catch {
          /* claim suivant */
        }
      }
      return null
    }

    // Filtre strict : un humain (P31=Q5) n'est un artiste QUE s'il a une
    // occupation musicale (P106). Un groupe musical (P31) l'est toujours.
    // Les politiciens, acteurs, sportifs, présentateurs… sont ainsi exclus.
    const p31 = claims.P31 ?? []
    const instanceTypes: string[] = []
    for (const c of p31) {
      const value = (c as { mainsnak?: { datavalue?: { value?: { id?: string } } } })
        .mainsnak?.datavalue?.value?.id
      if (value) instanceTypes.push(value)
    }
    const isGroup = instanceTypes.some((id) => MUSICAL_GROUP_TYPES.has(id))
    const isHuman = instanceTypes.includes('Q5')
    const p106 = claims.P106 ?? []
    const occupations: string[] = []
    for (const c of p106) {
      const value = (c as { mainsnak?: { datavalue?: { value?: { id?: string } } } })
        .mainsnak?.datavalue?.value?.id
      if (value) occupations.push(value)
    }
    const hasMusicOccupation = occupations.some((id) => MUSIC_OCCUPATIONS.has(id))
    // Humanin sans occupation musicale déclarée : exclusion (politiciens…).
    const isArtist = isGroup || (isHuman && hasMusicOccupation) || (!isHuman && hasMusicOccupation)

    const platforms: ArtistPlatforms = {}
    const socials: ArtistSocials = {}
    const website = val('P856')
    if (typeof website === 'string' && website) platforms.website = website
    const yt = val('P2397')
    if (typeof yt === 'string' && yt) platforms.youtube = `https://www.youtube.com/channel/${yt}`
    const spotify = val('P1324')
    if (typeof spotify === 'string' && spotify) platforms.spotify = `https://open.spotify.com/artist/${spotify}`
    const insta = val('P2002')
    if (typeof insta === 'string' && insta) socials.instagram = `https://www.instagram.com/${insta}`
    const fb = val('P2013')
    if (typeof fb === 'string' && fb) socials.facebook = `https://www.facebook.com/${fb}`
    const tw = val('P2003')
    if (typeof tw === 'string' && tw) socials.twitter = `https://x.com/${tw}`
    const tt = val('P7085')
    if (typeof tt === 'string' && tt) socials.tiktok = `https://www.tiktok.com/@${tt}`
    const mbid = val('P434')
    const country = val('P27') ?? val('P495')
    return {
      platforms,
      socials,
      countryQid: (country as { id?: string } | null)?.id,
      mbid: typeof mbid === 'string' ? mbid : undefined,
      isArtist,
    }
  } catch {
    return { platforms: {}, socials: {}, isArtist: false }
  }
}

/** Libellés (français puis anglais) d'une liste d'entités Wikidata. */
async function fetchWikidataLabels(
  qids: string[],
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  if (qids.length === 0) return {}
  try {
    const url =
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join('|')}` +
      `&props=labels&languages=fr%7Cen&format=json&origin=*`
    const res = await fetch(url, { signal })
    if (!res.ok) return {}
    const data = (await res.json()) as {
      entities?: Record<string, { labels?: Record<string, { value?: string }> }>
    }
    const out: Record<string, string> = {}
    for (const [id, entity] of Object.entries(data.entities ?? {})) {
      const label = entity.labels?.fr?.value ?? entity.labels?.en?.value
      if (label) out[id] = label
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Recherche MusicBrainz (artiste, alias, genre, lieu) avec enrichissement
 * (plateformes, réseaux, vraie bio Wikipedia).
 */
async function searchMusicBrainz(query: string, signal?: AbortSignal): Promise<DiscoveredArtist[]> {
  // Les requêtes multi-mots sont mises entre guillemets (phrase) :
  // « artist:Macky 2 » matcherait surtout des artistes en « 2… ».
  const term = /[\s-]/.test(query) ? `"${query}"` : query
  const escaped = encodeURIComponent(term)

  const runQuery = async (field: string): Promise<MbArtist[]> => {
    const url =
      `https://musicbrainz.org/ws/2/artist/?query=${field}:${escaped}` +
      `&fmt=json&limit=8`
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': MUSICBRAINZ_USER_AGENT },
        signal,
      })
      if (!res.ok) return []
      const data = (await res.json()) as { artists?: MbArtist[] }
      return data.artists ?? []
    } catch {
      return []
    }
  }

  // 1) Artiste, 2) alias (noms de scène), 3) genre (tag), 4) lieu (area).
  // On s'arrête dès que la moisson est suffisante (limite ~1 requête/sec).
  const artistHits = await runQuery('artist')
  let aliasHits: MbArtist[] = []
  let tagHits: MbArtist[] = []
  let areaHits: MbArtist[] = []
  if (artistHits.length < 3 && !signal?.aborted) {
    await sleep(400, signal)
    aliasHits = await runQuery('alias')
  }
  if (artistHits.length < 2 && !signal?.aborted) {
    await sleep(400, signal)
    tagHits = await runQuery('tag')
    await sleep(400, signal)
    areaHits = await runQuery('area')
  }

  const seen = new Set<string>()
  const ordered: MbArtist[] = []
  for (const list of [artistHits, aliasHits, tagHits, areaHits]) {
    for (const item of list) {
      if (!item.id || seen.has(item.id) || JUNK_MB_NAME.test(item.name)) continue
      seen.add(item.id)
      ordered.push(item)
    }
  }

  const out: DiscoveredArtist[] = []
  for (let i = 0; i < ordered.length; i += 1) {
    const item = ordered[i]
    await sleep(i === 0 ? 1200 : 600, signal)
    if (signal?.aborted) break
    const enriched = await enrichArtist(item.id, signal)
    const relations = enriched.relations ?? item.relations
    const { platforms, socials, wikipediaUrl, wikidataId } = extractLinks({
      ...item,
      relations,
    })

    // Anti-politicien : si on peut identifier l'entité (Wikidata direct ou
    // via sa page Wikipedia), on vérifie que c'est bien un artiste musical.
    let qid = wikidataId ?? null
    if (!qid && wikipediaUrl && !signal?.aborted) {
      qid = await resolveWikidataId(wikipediaUrl, signal)
    }
    if (qid && !signal?.aborted) {
      const wd = await fetchWikidataArtist(qid, signal)
      // Personne connue mais pas musicienne (politicien, acteur, sportif…) : on écarte.
      if (!wd.isArtist && !wd.mbid) continue
    }

    let bio =
      [
        item.disambiguation,
        item['life-span']?.begin ? `Active since ${item['life-span'].begin}.` : '',
      ].filter(Boolean).join(' ') || ''
    let image = ''
    if (wikipediaUrl) {
      const wiki = await fetchWikipediaBio(wikipediaUrl)
      if (wiki.bio) bio = wiki.bio
      image = wiki.image
    } else if (qid) {
      const wiki = await wikipediaFromWikidata(qid)
      if (wiki.bio) bio = wiki.bio
      image = wiki.image
    }
    if (!bio) bio = 'Artist found on Musibrainz.'

    // Ville d'origine : begin-area (naissance/formation) prime sur la zone
    // actuelle (area). Le pays est le code ISO MusicBrainz (le plus fiable).
    const country = enriched.country ?? item.country ?? enriched.area?.name ?? ''
    // Sans ville précise, on laisse vide (jamais le nom du pays comme ville) :
    // l'ajout proposera alors la demande de référencement au lieu de poser un
    // pin au centroïde du pays (et d'inventer de fausses « villes »).
    const rawCity =
      enriched['begin-area']?.name ?? enriched.area?.name ?? item.area?.name ?? ''
    // Si la zone renvoyée est en réalité un pays (MusicBrainz renvoie souvent
    // « Nigeria » comme area), on ne la prend pas pour une ville : city vide →
    // « Ajouter à la carte » désactivé, référencement proposé.
    const city = rawCity && countryByName(rawCity) ? '' : rawCity
    out.push({
      id: `mb-${item.id}`,
      name: item.name,
      genre: cleanGenre(item.tags?.[0]?.name ?? item.disambiguation ?? ''),
      city,
      country,
      flag: flagFor(country.length === 2 ? country : item.country ?? null),
      lat: 0,
      lng: 0,
      bio,
      image,
      source: 'musicbrainz',
      platforms,
      socials,
      // Type artiste (solo) / groupe, exposé pour l'admin.
      type: enriched.type ?? item.type,
    })
  }
  return out
}

/**
 * Secours Wikipedia + Wikidata : artistes absents de MusicBrainz mais
 * présents sur Wikipedia (vraie bio) avec liens réels (site officiel,
 * YouTube, Instagram, Facebook, Twitter/X, TikTok, Spotify) et pays.
 */
async function searchWikipediaFallback(
  query: string,
  signal?: AbortSignal,
): Promise<DiscoveredArtist[]> {
  let pages = await searchWikipediaPages(query, signal)
  let source: 'wikipedia' | 'wikidata' = 'wikipedia'
  if (pages.length === 0 && !signal?.aborted) {
    pages = await searchWikidataEntities(query, signal)
    source = 'wikidata'
  }
  pages = pages.filter((p) => !NON_PERSON_SUFFIX.test(p.title)).slice(0, 5)
  if (pages.length === 0) return []

  // Passe 1 : résumé + claims (en parallèle par page).
  const enriched: Array<{
    page: WikipediaPage
    summary: { extract?: string; description?: string; image?: string } | null
    wd: {
      platforms: ArtistPlatforms
      socials: ArtistSocials
      countryQid?: string
      mbid?: string
      isArtist: boolean
    }
  }> = []
  for (const page of pages) {
    if (signal?.aborted) break
    const [summary, wd] = await Promise.all([
      fetchWikipediaSummary(page.title, signal),
      fetchWikidataArtist(page.qid, signal),
    ])
    // On écarte les pages qui ne sont pas des artistes (genres, séries…).
    if (!wd.isArtist && !wd.mbid) continue
    enriched.push({ page, summary, wd })
  }

  // Pays résolus en une seule requête groupée.
  const countryQids = [
    ...new Set(enriched.map((e) => e.wd.countryQid).filter((x): x is string => Boolean(x))),
  ]
  const countryLabels = await fetchWikidataLabels(countryQids, signal)

  // Passe 2 : construction des artistes.
  const out: DiscoveredArtist[] = []
  for (const { page, summary, wd } of enriched) {
    if (signal?.aborted) break
    const name = cleanWikiTitle(page.title)
    const bio =
      (summary?.extract ?? '').trim().slice(0, 500) ||
      (source === 'wikipedia' ? 'Artiste trouvé sur Wikipedia.' : 'Artiste trouvé sur Wikidata.')
    const country = wd.countryQid ? (countryLabels[wd.countryQid] ?? '') : ''
    out.push({
      id: `wiki-${page.qid}`,
      name,
      genre: cleanGenre(summary?.description ?? ''),
      city: '',
      country,
      flag: '🌍',
      lat: 0,
      lng: 0,
      bio,
      image: summary?.image ?? '',
      source,
      platforms: wd.platforms,
      socials: {
        ...wd.socials,
        wikipedia: `https://en.wikipedia.org/wiki/${page.title.replace(/ /g, '_')}`,
      },
    })
  }
  return out
}

/**
 * Recherche en ligne multi-sources : MusicBrainz d'abord (artiste, genre,
 * lieu), complété par Wikipedia + Wikidata quand il ne trouve rien.
 * Récupère plateformes, réseaux et vraie bio pour chaque candidat.
 */
export async function searchArtistOnline(
  query: string,
  signal?: AbortSignal,
): Promise<DiscoveredArtist[]> {
  const q = query.trim()
  if (!q) return []

  const mbResults = await searchMusicBrainz(q, signal)

  // MusicBrainz insuffisant → secours Wikipedia/Wikidata.
  let fallback: DiscoveredArtist[] = []
  if (mbResults.length < 3 && !signal?.aborted) {
    fallback = await searchWikipediaFallback(q, signal)
  }

  // Fusion + dédoublonnage par nom (MusicBrainz garde la priorité).
  const seen = new Set<string>()
  const merged: DiscoveredArtist[] = []
  for (const artist of [...mbResults, ...fallback]) {
    const key = artist.name.trim().toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(artist)
  }

  // Un hit MusicBrainz sans vraie bio profite de celle du secours.
  for (const artist of merged) {
    const isGeneric =
      !artist.bio ||
      artist.bio === 'Artist found on Musibrainz.' ||
      (artist.bio.length < 60 && artist.bio.includes('Active since'))
    if (!isGeneric) continue
    const match = fallback.find(
      (f) => f.name.trim().toLowerCase() === artist.name.trim().toLowerCase(),
    )
    if (!match) continue
    if (match.bio) artist.bio = match.bio
    if (match.image && !artist.image) artist.image = match.image
    if (Object.keys(match.platforms ?? {}).length) {
      artist.platforms = { ...artist.platforms, ...match.platforms }
    }
    if (Object.keys(match.socials ?? {}).length) {
      artist.socials = { ...artist.socials, ...match.socials }
    }
  }
  // Repli AGENT : quand la recherche de base est mince (peu de résultats ou
  // aucune vraie bio), l'agent à outils (edge function, prod) deep-search et
  // vérifie le meilleur candidat côté serveur. Dégradation silencieuse.
  const hasRealBio = merged.some(
    (m) => m.bio && m.bio.length > 60 && !m.bio.includes('Musibrainz'),
  )
  if (!signal?.aborted && (merged.length < 3 || !hasRealBio)) {
    try {
      const deep = await agentDeepSearch(q)
      const already =
        deep &&
        merged.some(
          (m) => m.name.trim().toLowerCase() === deep.name.trim().toLowerCase(),
        )
      if (deep && !already) merged.push(deep)
    } catch {
      /* on garde la recherche de base */
    }
  }
  if (signal?.aborted) return merged
  // Vérification IA (Mistral) des candidats consolidés : filtrage intelligent
  // des non-musiciens + normalisation genre/bio. Dégradation silencieuse si
  // l'edge function n'est pas déployée ou si Mistral est indisponible.
  try {
    const verified = await aiVerifyCandidates(merged)
    // `verified === null` → vérification indisponible : on garde le brut.
    // `verified === []` → l'IA a rejeté les candidats (non-musiciens) : on
    //   ne montre AUCUNE section en ligne ni bouton ajout/revendication.
    if (verified && verified.length > 0) return verified
    if (verified !== null) return []
  } catch {
    /* on garde le résultat brut */
  }
  return merged
}

interface AiVerdict {
  id?: string
  verdict?: string
  reason?: string
  genre?: string
  bio?: string
}

/**
 * Cache court des verdicts IA par artiste (10 min, session). On ne met en
 * cache QUE les verdicts « keep » (enrichissement genre/bio) — jamais un
 * rejet, pour qu'un faux positif ne condamne pas un artiste à vie.
 */
const aiVerdictCache = new Map<
  string,
  { at: number; genre: string; bio: string }
>()
const AI_CACHE_TTL_MS = 10 * 60 * 1000

function cachedVerdict(artist: DiscoveredArtist): Partial<AiVerdict> | null {
  const entry = aiVerdictCache.get(artist.id)
  if (!entry || Date.now() - entry.at > AI_CACHE_TTL_MS) return null
  return { verdict: 'keep', genre: entry.genre, bio: entry.bio }
}

/**
 * Repli « agent à outils » (edge function ai_artist_agent, prod) : quand la
 * recherche de base est mince (peu de résultats, pas de bio réelle), l'agent
 * creuse côté serveur — search → details → vérification Wikidata → bio/photo
 * Wikipedia → géocodage → verdict Mistral. Retourne null si la fonction
 * n'est pas déployée, si elle est lente (> 9 s) ou si l'agent rejette.
 * Résultats mis en cache par requête (10 min) pour ne pas brûler le budget
 * Mistral/API à chaque frappe.
 */
const agentQueryCache = new Map<
  string,
  { at: number; artist: DiscoveredArtist | null }
>()
const AGENT_QUERY_TTL_MS = 10 * 60 * 1000
async function agentDeepSearch(query: string): Promise<DiscoveredArtist | null> {
  if (!hasSupabase()) return null
  const cacheKey = query.trim().toLowerCase()
  const cached = agentQueryCache.get(cacheKey)
  if (cached && Date.now() - cached.at <= AGENT_QUERY_TTL_MS) return cached.artist
  const invoke = supabase!.functions.invoke('ai_artist_agent', {
    body: { query, maxSteps: 8 },
  })
  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), 9000),
  )
  const out = (await Promise.race([invoke, timeout])) as
    | {
        data?: {
          status?: string
          candidate?: {
            id?: string
            name?: string
            genre?: string
            country?: string
            city?: string
            bio?: string
            image?: string
            lat?: number
            lng?: number
          }
          verdict?: { verdict?: string; genre?: string; bio?: string }
        }
      }
    | 'timeout'
  let result: DiscoveredArtist | null = null
  if (out !== 'timeout' && out.data) {
    const data = out.data
    const candidate = data.candidate
    if (
      candidate?.name &&
      data.status !== 'empty' &&
      data.status !== 'rejected' &&
      data.verdict?.verdict !== 'reject'
    ) {
      const name = candidate.name
      const country = candidate.country ?? ''
      // Garde pays-comme-ville : l'agent peut rendre « Nigeria » comme city
      // (area MusicBrainz = pays). On la vide → « Ajouter à la carte »
      // désactivé + référencement proposé, jamais de pin au centroïde.
      const rawCity = candidate.city ?? ''
      const city = rawCity && countryByName(rawCity) ? '' : rawCity
      result = {
        id: candidate.id ?? `agent-${name}`,
        name,
        genre: data.verdict?.genre || candidate.genre || '',
        city,
        country,
        flag: country.length === 2 ? flagFor(country) : '🌍',
        lat: candidate.lat ?? 0,
        lng: candidate.lng ?? 0,
        bio:
          data.verdict?.bio && data.verdict.bio.length >= 40
            ? data.verdict.bio
            : (candidate.bio ?? ''),
        image: candidate.image ?? undefined,
        source: 'musicbrainz',
        platforms: {},
        socials: {},
        verified: false,
        claimedBy: null,
      }
    }
  }
  // Cache par requête normalisée (10 min, y compris les résultats vides) :
  // une requête « mince » ne doit pas relancer l'agent à chaque frappe.
  agentQueryCache.set(cacheKey, { at: Date.now(), artist: result })
  return result
}

/**
 * Vérification IA des candidats (edge function ai_verify → Mistral) :
 * filtre les non-musiciens (politiciens, acteurs…) et normalise genre/bio.
 * Retourne null si la fonction n'est pas déployée, si Mistral échoue ou si
 * l'IA rejette tout (dégradation silencieuse : on garde le résultat brut).
 */
async function aiVerifyCandidates(
  artists: DiscoveredArtist[],
): Promise<DiscoveredArtist[] | null> {
  if (!hasSupabase() || artists.length === 0) return null
  const invoke = supabase!.functions.invoke('ai_verify', {
    body: {
      artists: artists.map((a) => ({
        id: a.id,
        name: a.name,
        genre: a.genre,
        city: a.city,
        country: a.country,
        bio: (a.bio ?? '').slice(0, 800),
        source: a.source,
        type: a.type,
        links: [...Object.values(a.platforms ?? {}), ...Object.values(a.socials ?? {})]
          .filter(Boolean),
      })),
    },
  })
  // Garde-fou : fonction absente ou lente → repli après 6 s (la recherche
  // ne doit jamais être bloquée par l'étape IA).
  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), 6000),
  )
  const out = (await Promise.race([invoke, timeout])) as
    | { data?: { results?: AiVerdict[] }; error?: { message?: string } }
    | 'timeout'
  if (out === 'timeout' || !out.data?.results) return null
  const byId = new Map((out.data.results ?? []).map((r) => [r.id, r]))
  const kept: DiscoveredArtist[] = []
  for (const artist of artists) {
    // Cache local (10 min) : pas de re-vérification du même artiste à chaque
    // frappe — la recherche est le chemin le plus chaud de l'app.
    const cached = cachedVerdict(artist)
    const verdict = cached ?? byId.get(artist.id)
    // Un artiste SANS verdict (non révisé) est conservé tel quel — seul un
    // rejet EXPLICITE de l'IA le retire. Gating Musibrainz : si l'IA juge
    // que ce n'est pas un musicien, on ne propose plus d'ajout/revendication.
    if (!verdict) {
      kept.push(artist)
      continue
    }
    if (verdict.verdict === 'reject') continue
    const genre =
      verdict.genre && verdict.genre !== artist.genre ? verdict.genre : artist.genre
    const bio = verdict.bio && verdict.bio.length >= 40 ? verdict.bio : artist.bio
    if (cached) {
      kept.push({ ...artist, genre, bio })
      continue
    }
    if (verdict.verdict === 'keep') {
      aiVerdictCache.set(artist.id, { at: Date.now(), genre, bio })
    }
    kept.push({ ...artist, genre, bio })
  }
  // `null` = vérification indisponible (dégradation silencieuse) ;
  // `[]` = tous rejetés → la recherche en ligne est vide (gating Brainz).
  return kept.length > 0 ? kept : []
}

/** Verdict IA renvoyé par l'edge function ai_verify (usage admin). */
export interface AiReviewResult {
  id: string
  verdict?: string
  reason?: string
  genre?: string
  bio?: string
  is_musician?: boolean
}

/**
 * Assistant IA pour l'admin : envoie une liste d'artistes de la carte à
 * l'edge function ai_verify (Mistral) pour corriger les genres mal écrits
 * et réécrire les bios. Aucune écriture ici — l'admin valide avant
 * application. Dégradation propre si la fonction n'est pas déployée.
 */
export async function aiReviewArtists(
  artists: Array<{
    id: string
    name: string
    genre: string
    city: string
    country: string
    bio: string
  }>,
): Promise<{ ok: boolean; results: AiReviewResult[]; error?: string }> {
  if (!hasSupabase() || artists.length === 0) {
    return { ok: false, error: 'Supabase non configuré', results: [] }
  }
  try {
    const { data, error } = await supabase!.functions.invoke('ai_verify', {
      body: {
        artists: artists.map((a) => ({
          id: a.id,
          name: a.name,
          genre: a.genre,
          city: a.city,
          country: a.country,
          bio: (a.bio ?? '').slice(0, 800),
          source: 'map_artists',
        })),
      },
    })
    if (error) return { ok: false, error: error.message, results: [] }
    const results = (data?.results ?? []) as AiReviewResult[]
    if (results.length === 0) {
      return { ok: false, error: 'Réponse IA vide', results: [] }
    }
    return { ok: true, results }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur inconnue',
      results: [],
    }
  }
}

/**
 * Géocode un lieu via Mapbox (token public du site). Retourne [lng, lat] ou null.
 */
/** Résultat de géocodage : coordonnées + code pays résolu (si disponible). */
interface GeocodeResult {
  lng: number
  lat: number
  country?: string
}

async function geocodePlace(
  place: string,
  expectedCountry?: string | null,
): Promise<GeocodeResult | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  if (!token || !place.trim()) return null
  try {
    const countryCode = normalizeCountryCode(expectedCountry)
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(place)}.json` +
      // neighborhood : le quartier est géocodé aussi (pins dispersés par
      // quartier au lieu du centre-ville).
      `?access_token=${token}&limit=3&types=place,region,locality,neighborhood` +
      // Filtre strict par pays déclaré : « Cotonou, BJ » ne peut plus
      // jamais résoudre vers un autre pays.
      (countryCode ? `&country=${countryCode}` : '')
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      features?: Array<{ center?: [number, number]; context?: Array<{ id?: string; short_code?: string }> }>
    }
    const features = data.features ?? []
    for (const feature of features) {
      const center = feature.center
      if (!center || center.length !== 2) continue
      // Validation croisée : le pays réel du résultat doit correspondre au
      // pays déclaré (sinon on rejette ce résultat et on essaie le suivant).
      if (countryCode) {
        const real = countryCodeOfFeature(feature)
        if (real && real !== countryCode) continue
      }
      // Le pays résolu (contexte Mapbox) sert de repli quand MusicBrainz
      // n'a pas déclaré de pays : « Toronto » → CA, sinon le champ reste vide.
      const resolved = countryCodeOfFeature(feature)
      return {
        lng: center[0],
        lat: center[1],
        country: countryCode ?? resolved ?? undefined,
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Géocode une ville et renvoie les coordonnées + le pays déduit du résultat
 * (code ISO + drapeau). Utilisé pour la conversion waitlist → carte : une
 * entrée n'a qu'une ville libre (« Cotonou, Bénin »), on déduit le pays.
 */
export async function geocodeCityWithCountry(
  place: string,
): Promise<{ lng: number; lat: number; country: string; flag: string } | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  if (!token || !place.trim()) return null
  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(place)}.json` +
      `?access_token=${token}&limit=1&types=place,region,locality`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      features?: Array<{ center?: [number, number]; context?: Array<{ id?: string; short_code?: string }> }>
    }
    const feature = data.features?.[0]
    const center = feature?.center
    if (!center || center.length !== 2) return null
    const code = countryCodeOfFeature(feature) ?? normalizeCountryCode(place)
    return {
      lng: center[0],
      lat: center[1],
      country: code ?? '',
      flag: code ? flagFor(code) : '🌍',
    }
  } catch {
    return null
  }
}

/**
 * Géolocalisation inverse (navigateur) → ville + pays ISO.
 * Utilisée par le bouton « Me localiser » de l'inscription (comme le mobile).
 */
export interface GeocodeReverseResult {
  city: string
  countryCode: string | null
  /** true si l'utilisateur a refusé la permission de géolocalisation. */
  denied?: boolean
}

export async function reverseGeocodeBrowser(): Promise<GeocodeReverseResult | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  type PosResult = GeolocationPosition | { denied: true } | null
  const pos = await new Promise<PosResult>((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      (err) => resolve(err && err.code === 1 ? { denied: true } : null),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  })
  if (!pos || !token) return null
  if ('denied' in pos) return { city: '', countryCode: null, denied: true }
  try {
    const [lng, lat] = [pos.coords.longitude, pos.coords.latitude]
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1&types=place,locality`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      features?: Array<{
        text?: string
        context?: Array<{ id?: string; short_code?: string }>
      }>
    }
    const feature = (data.features ?? [])[0]
    if (!feature?.text) return null
    return {
      city: feature.text,
      countryCode: countryCodeOfFeature(feature),
    }
  } catch {
    return null
  }
}

export interface CitySuggestion {
  /** Nom de la ville (ex. « Cotonou »). */
  city: string
  /** Nom complet renvoyé par Mapbox (ex. « Cotonou, Littoral, Bénin »). */
  label: string
  lng: number
  lat: number
  /** Code ISO du pays déduit du résultat (bj, fr…). */
  countryCode: string | null
}

/**
 * Autocomplete de villes via Mapbox (types place/locality), filtré par pays.
 * Couvre le monde entier sans embarquer de base de données de villes.
 */
export async function suggestCities(
  query: string,
  countryCode?: string | null,
  signal?: AbortSignal,
): Promise<CitySuggestion[]> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  const q = query.trim()
  if (!token || q.length < 2) return []
  try {
    const params = new URLSearchParams({
      access_token: token,
      limit: '6',
      types: 'place,locality',
      language: 'fr',
    })
    if (countryCode && /^[A-Za-z]{2}$/.test(countryCode)) {
      params.set('country', countryCode)
    }
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`,
      { signal },
    )
    if (!res.ok) return []
    const data = (await res.json()) as {
      features?: Array<{
        text?: string
        place_name?: string
        center?: [number, number]
        context?: Array<{ id?: string; short_code?: string }>
      }>
    }
    return (data.features ?? [])
      .map((feature) => {
        const center = feature.center
        if (!center || center.length !== 2 || !feature.text) return null
        return {
          city: feature.text,
          label: feature.place_name ?? feature.text,
          lng: center[0],
          lat: center[1],
          countryCode: countryCodeOfFeature(feature),
        }
      })
      .filter((x): x is CitySuggestion => x !== null)
  } catch {
    return []
  }
}

/** Quartier / district / localité suggéré par Mapbox (recherche géo). */
export interface NeighborhoodSuggestion {
  /** Nom du quartier (ex. « Bastille », « Yopougon »). */
  name: string
  /** Ville de rattachement (contexte Mapbox « place »). */
  city: string
  /** Pays de rattachement (contexte Mapbox « country »). */
  country: string
  /** Code ISO du pays déduit du résultat. */
  countryCode: string | null
  lng: number
  lat: number
}

/**
 * Recherche de QUARTIERS (et localités) via Mapbox geocoding — types
 * neighborhood + locality, filtrés sur la requête. Permet de chercher un
 * « quartier » (Bastille, Yopougon, Almadies…) et pas seulement une ville.
 * Couvre le monde entier sans embarquer de base de données.
 */
export async function searchNeighborhoods(
  query: string,
  signal?: AbortSignal,
): Promise<NeighborhoodSuggestion[]> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  const q = query.trim()
  if (!token || q.length < 2) return []
  try {
    // « place » est exclu : les villes sont déjà couvertes par placeResults
    // (Lieux) — on ne veut que les QUARTIERS / localités ici, sans doublon.
    const params = new URLSearchParams({
      access_token: token,
      limit: '5',
      types: 'neighborhood,locality',
      language: 'fr',
    })
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`,
      { signal },
    )
    if (!res.ok) return []
    const data = (await res.json()) as {
      features?: Array<{
        text?: string
        place_name?: string
        center?: [number, number]
        context?: Array<{ id?: string; short_code?: string; text?: string }>
      }>
    }
    const out: NeighborhoodSuggestion[] = []
    for (const feature of data.features ?? []) {
      const center = feature.center
      if (!center || center.length !== 2 || !feature.text) continue
      const ctx = feature.context ?? []
      const place = ctx.find((x) => (x.id ?? '').startsWith('place'))
      const country = ctx.find((x) => (x.id ?? '').startsWith('country'))
      const countryCode = countryCodeOfFeature(feature)
      out.push({
        name: feature.text,
        city: place?.text ?? '',
        country: country?.text ?? '',
        countryCode,
        lng: center[0],
        lat: center[1],
      })
    }
    return out
  } catch {
    return []
  }
}

/** Artistes déjà ajoutés à la carte (table map_artists). */
export async function fetchMapArtists(): Promise<DiscoveredArtist[]> {
  if (!hasSupabase()) return []
  // La migration 00016 ajoute plateformes/sociaux/vérification. Tant qu'elle
  // n'est pas appliquée en base, on retombe sur le schéma précédent.
  const RICH_SELECT =
    'id, name, genre, city, district, country, flag, lat, lng, bio, image, source, platforms, socials, verified, claimed_by, events, followers'
  const BASE_SELECT = 'id, name, genre, city, district, country, flag, lat, lng, bio, image, source'
  let { data, error } = await supabase!
    .from('map_artists')
    .select(RICH_SELECT)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error || !data) {
    // Repli : colonnes sans la migration 00016.
    const fallback = await supabase!
      .from('map_artists')
      .select(BASE_SELECT)
      .order('created_at', { ascending: false })
      .limit(500)
    data = (fallback.data ?? null) as unknown as typeof data
  }
  if (!data) return []
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    genre: row.genre ?? '',
    city: row.city ?? '',
    district: row.district ?? undefined,
    country: row.country ?? '',
    flag: row.flag ?? '🌍',
    lat: row.lat,
    lng: row.lng,
    bio: row.bio ?? '',
    image: row.image ?? undefined,
    source: row.source ?? 'web',
    platforms: (row.platforms ?? {}) as ArtistPlatforms,
    socials: (row.socials ?? {}) as ArtistSocials,
    verified: row.verified ?? false,
    claimedBy: row.claimed_by ?? null,
    events: (row.events ?? []) as ArtistEvent[],
    followers: row.followers ? String(row.followers) : '',
  }))
}

/** Ajoute un artiste découvert à la carte (upsert). */
export async function addMapArtist(artist: DiscoveredArtist): Promise<{
  ok: boolean
  error?: string
}> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }
  if (!artist.lat || !artist.lng) {
    return { ok: false, error: 'Localisation inconnue pour cet artiste.' }
  }
  const payload = {
    id: artist.id,
    name: artist.name,
    genre: artist.genre,
    city: artist.city,
    district: artist.district ?? null,
    country: artist.country,
    flag: artist.flag,
    lat: artist.lat,
    lng: artist.lng,
    bio: artist.bio,
    image: artist.image ?? null,
    source: artist.source,
  }
  // Colonnes enrichies (migration 00016/00019) — avec repli si absent de la base.
  let { error } = await supabase!
    .from('map_artists')
    .upsert(
      {
        ...payload,
        platforms: artist.platforms ?? {},
        socials: artist.socials ?? {},
        verified: artist.verified ?? false,
        claimed_by: artist.claimedBy ?? null,
      },
      { onConflict: 'id' },
    )
  if (error && /platforms|socials|verified|claimed_by|image/i.test(error.message)) {
    const retry = await supabase!.from('map_artists').upsert(payload, { onConflict: 'id' })
    error = retry.error
  }
  return error ? { ok: false, error: error.message } : { ok: true }
}

/**
 * Ajoute OU met à jour un artiste sur la carte via le RPC sécurisé
 * add_or_update_map_artist (migration 00018). L'update enrichit le profil
 * existant (bio, plateformes, réseaux) sans toucher à la modération
 * (verified, claimed_by). Retourne aussi « updated » pour le feedback UI.
 */
export async function addOrUpdateMapArtist(
  artist: DiscoveredArtist,
  opts: { claimedBy?: string } = {},
): Promise<{
  ok: boolean
  error?: string
  id?: string
  updated?: boolean
}> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }
  const { data, error } = await supabase!.rpc('add_or_update_map_artist', {
    p_artist: {
      id: artist.id,
      name: artist.name,
      genre: artist.genre,
      city: artist.city,
      district: artist.district ?? null,
      country: artist.country,
      flag: artist.flag,
      lat: artist.lat,
      lng: artist.lng,
      bio: artist.bio,
      image: artist.image ?? null,
      source: artist.source,
      platforms: artist.platforms ?? {},
      socials: artist.socials ?? {},
      claimed_by: opts.claimedBy ?? null,
    },
  })
  if (error) return { ok: false, error: error.message }
  const result = data as { ok?: boolean; error?: string; id?: string; updated?: boolean } | null
  if (!result?.ok) return { ok: false, error: result?.error ?? 'Erreur inconnue' }
  // Nouvel artiste : on notifie les utilisateurs concernés (migration 00029,
  // repli silencieux si la fonction n'est pas encore en base).
  if (result.updated !== true) {
    void import('@musimaps/shared').then(({ triggerDiscoveryNotification }) =>
      triggerDiscoveryNotification({
        id: artist.id,
        name: artist.name,
        genre: artist.genre,
        city: artist.city,
        country: artist.country,
      }),
    )
  }
  return { ok: true, id: result.id, updated: result.updated }
}

/** Supprime un artiste découvert de la carte (admin). */
export async function removeMapArtist(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }
  const { error } = await supabase!.from('map_artists').delete().eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Corrige les informations d'un artiste découvert (admin ou propriétaire). */
export async function updateMapArtist(
  id: string,
  patch: Partial<{
    name: string
    genre: string
    city: string
    district: string
    country: string
    flag: string
    lat: number
    lng: number
    bio: string
    image: string
    cover: string
    platforms: ArtistPlatforms
    socials: ArtistSocials
    verified: boolean
  }>,
  opts?: { skipGenreClean?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }
  // Le genre est normalisé à l'enregistrement pour que l'admin et le site
  // public affichent la même valeur (évite le round-trip incohérent).
  // Exceptions : les corrections de l'assistant IA sont déjà normalisées
  // par Mistral (skipGenreClean) — on ne doit pas les ré-écraser.
  if (patch.genre !== undefined && !opts?.skipGenreClean) patch.genre = cleanGenre(patch.genre)
  let { error } = await supabase!.from('map_artists').update(patch).eq('id', id)
  // Repli : colonnes enrichies absentes tant que les migrations 00016/00019/00031 ne sont pas appliquées.
  if (error && /platforms|socials|verified|claimed_by|image|cover/i.test(error.message)) {
    const { platforms: _p, socials: _s, image: _i, cover: _c, ...base } = patch
    const retry = await supabase!.from('map_artists').update(base).eq('id', id)
    error = retry.error
  }
  return error ? { ok: false, error: error.message } : { ok: true }
}

export type MapArtistView = Artist & {
  platforms: ArtistPlatforms
  socials: ArtistSocials
  source: string
  claimedBy: string | null
  image?: string
}

/** Convertit un artiste découvert en type Artist (pour GlobeMap / fiches). */
export function toArtist(d: DiscoveredArtist): MapArtistView {
  return {
    id: d.id,
    name: d.name,
    genre: cleanGenre(d.genre),
    city: d.city,
    district: d.district ?? undefined,
    country: d.country,
    flag: d.flag,
    coordinates: [d.lng, d.lat],
    bio: d.bio,
    image: d.image,
    followers: d.followers ?? '',
    color: DEFAULT_COLOR,
    tracks: [],
    events: d.events ?? [],
    verified: d.verified ?? false,
    platforms: d.platforms ?? {},
    socials: d.socials ?? {},
    source: d.source,
    claimedBy: d.claimedBy ?? null,
  }
}

/** Localise un candidat déjà trouvé (géocodage Mapbox). */
export async function locateArtist(artist: DiscoveredArtist): Promise<{
  artist?: DiscoveredArtist
  error?: string
}> {
  // Sans ville, le géocodage d'un pays seul renvoie un centroïde ou un
  // mauvais pays (« Guinée » → Guinée équatoriale). On refuse : l'artiste
  // doit avoir une ville précise pour être placé sur la carte.
  if (!artist.city?.trim()) return { artist, error: 'no-location' }
  // Le quartier est géocodé en priorité (« Yopougon, Abidjan, CI ») : le pin
  // atterrit dans le vrai quartier et deux artistes d'une même ville mais de
  // quartiers différents ne s'empilent jamais sur le centre-ville.
  const place = [artist.district, artist.city, artist.country]
    .filter((v) => v && v.trim())
    .join(', ')
  const coords = await geocodePlace(place, artist.country)
  if (!coords) return { artist, error: 'no-location' }
  // Pays stocké normalisé en code ISO (drapeau + recherche par pays).
  // Le pays GÉOGRAPHIQUE résolu par le géocodage PRIME (« Cape Town » → ZA) :
  // le pays déclaré (origine, MusicBrainz) ne doit jamais l'écraser, sinon un
  // artiste d'origine US installé à Johannesburg formerait un cluster « US »
  // fantôme posé au-dessus de l'Afrique du Sud. Le déclaré ne sert que de
  // repli quand Mapbox ne résout pas de pays.
  const countryCode = coords.country ?? normalizeCountryCode(artist.country)
  return {
    artist: {
      ...artist,
      lng: coords.lng,
      lat: coords.lat,
      country: countryCode ?? artist.country ?? '',
      flag: countryCode ? flagFor(countryCode) : artist.flag,
    },
  }
}

/**
 * Géocode la localisation d'un artiste en tenant compte du QUARTIER :
 * « district, ville, pays » (le quartier prime, sinon la ville). Utilisé par
 * l'admin quand un quartier est saisi/corrigé — le pin suit la vraie zone.
 */
export async function geocodeArtistLocation(
  city: string,
  country: string,
  district?: string | null,
): Promise<{ lng: number; lat: number; country?: string } | null> {
  const place = [district, city, country].filter((v) => v && v.trim()).join(', ')
  if (!place.trim()) return null
  const coords = await geocodePlace(place, country)
  if (!coords) return null
  return {
    lng: coords.lng,
    lat: coords.lat,
    // Pays résolu par Mapbox quand l'entrée n'en déclare pas : le pin
    // porte toujours un pays (drapeau + regroupement) même si la ligne
    // waitlist n'a pas de colonne pays.
    country: normalizeCountryCode(country) ?? coords.country ?? undefined,
  }
}

// ------------------------------------------------------------
// Revendication de profil (l'artiste prouve que c'est bien lui)
// ------------------------------------------------------------

/** Demande la revendication d'un profil de la carte. */
export async function requestClaim(
  mapArtistId: string,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }
  const { data, error } = await supabase!.rpc('request_claim', {
    p_map_artist_id: mapArtistId,
    p_note: note ?? null,
  })
  if (error) return { ok: false, error: error.message }
  const result = data as { ok?: boolean; error?: string } | null
  return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? 'Erreur inconnue' }
}

export interface ArtistClaim {
  id: string
  map_artist_id: string
  user_id: string
  user_email: string
  status: 'pending' | 'approved' | 'rejected'
  note: string | null
  created_at: string
  reviewed_at: string | null
}

/** Mes demandes de revendication (pour afficher l'état côté public). */
export async function fetchMyClaims(): Promise<ArtistClaim[]> {
  if (!hasSupabase()) return []
  const { data, error } = await supabase!
    .from('artist_claims')
    .select('id, map_artist_id, user_id, user_email, status, note, created_at, reviewed_at')
    .order('created_at', { ascending: false })
  return error ? [] : ((data ?? []) as ArtistClaim[])
}

// ------------------------------------------------------------
// Compte business
// ------------------------------------------------------------


