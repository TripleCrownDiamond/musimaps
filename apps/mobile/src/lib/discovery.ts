import { countryByName, type Artist, type ArtistEvent } from '@musimaps/shared';
import { supabase, hasSupabase } from './supabase';

/**
 * Recherche d'artistes en ligne (Musibrainz) — le pendant mobile de
 * apps/web/src/lib/discovery.ts : la carte est synchronisée car les deux
 * écrivent dans la même table Supabase map_artists. Depuis la synchro web,
 * la recherche mobile bénéficie du MÊME pipeline que le web : vérification
 * IA (ai_verify), agent à outils (ai_artist_agent), fallback Wikipedia /
 * Wikidata, enrichissement (plateformes, réseaux, photo HD) et genres
 * normalisés (cleanGenre).
 */

const MUSICBRAINZ_USER_AGENT = 'Musimaps/1.0 (https://musimaps.app)';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

/** Plateformes d'écoute publiques d'un artiste. */
export type ArtistPlatforms = Partial<
  Record<'youtube' | 'spotify' | 'apple_music' | 'bandcamp' | 'soundcloud' | 'deezer' | 'website', string>
>;

/** Réseaux sociaux d'un artiste. */
export type ArtistSocials = Partial<
  Record<'facebook' | 'instagram' | 'twitter' | 'tiktok' | 'wikipedia', string>
>;

/** Artiste trouvé en ligne (MusicBrainz), prêt à être ajouté à la carte. */
export interface DiscoveredArtist {
  id: string;
  name: string;
  genre: string;
  city: string;
  /** Quartier / district (ex. « Yopougon », « Bastille ») — ancre le pin
   *  dans le vrai quartier et disperse les artistes d'une même ville. */
  district?: string;
  country: string;
  flag: string;
  lat: number;
  lng: number;
  bio: string;
  image?: string;
  source: string;
  platforms?: ArtistPlatforms;
  socials?: ArtistSocials;
  verified?: boolean;
  claimedBy?: string | null;
  /** 'Person' (solo) ou 'Group' — distinction artiste / groupe. */
  type?: string;
  events?: ArtistEvent[];
  /** Popularité externe (fans Deezer) — anneau + stats de cluster. */
  followers?: string;
}

/** Couleur par défaut pour un artiste découvert (aucune identité visuelle). */
const DEFAULT_COLOR: [string, string] = ['#65D8D0', '#167A93'];

/** Convertit un pays ISO-3166 en emoji drapeau. */
function flagFor(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) return '🌍';
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + countryCode.charCodeAt(0) - 65,
    base + countryCode.charCodeAt(1) - 65,
  );
}

/**
 * Normalise un genre brut (tag MusicBrainz, description Wikipedia) en un
 * genre propre et lisible. Même liste que le web (synchro des résultats).
 */
const GENRE_RULES: Array<{ re: RegExp; genre: string }> = [
  { re: /amapiano/i, genre: 'Amapiano' },
  { re: /afrobeat|afrobeats|afro-beat/i, genre: 'Afrobeats' },
  { re: /hip[- ]?hop|rapper|rap\.?|gangsta/i, genre: 'Rap' },
  { re: /dancehall|reggaeton|dembow/i, genre: 'Dancehall' },
  { re: /reggae|ska/i, genre: 'Reggae' },
  { re: /r&?b|soul|neo[- ]?soul|rnb/i, genre: 'R&B / Soul' },
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
  { re: /zouk|coupe[- ]decale|coupé[- ]décalé/i, genre: 'Zouk / Coupé-décalé' },
  { re: /rumba|soukous|ndombolo|afro[- ]?pop|lingala/i, genre: 'Afro-pop' },
  { re: /highlife/i, genre: 'Highlife' },
  { re: /funk|disco/i, genre: 'Funk' },
  { re: /pop/i, genre: 'Pop' },
  { re: /classical|opera|orchestra/i, genre: 'Classique' },
  { re: /experimental|avant[- ]?garde/i, genre: 'Expérimental' },
];

/** Nationalités / adjectifs de pays : pas des genres. */
const NATIONALITY_RE =
  /^(american|british|english|french|german|italian|spanish|portuguese|brazilian|jamaican|japanese|korean|chinese|indian|nigerian|senegalese|ivoirien|belgian|swiss|dutch|canadian|mexican|argentine|colombian|cuban|maroccan|algerian|tunisian|congolese|latvian|estonian|lithuanian|polish|russian|ukrainian|turkish|swedish|norwegian|danish|finnish|australian|new zealander|south african|ghanian|kenyan|ethiopian|egyptian|lebanese|israeli|iranian|pakistani|indonesian|filipino|thai|vietnamese|uk)$/i;

/** Convertit un genre brut (phrase, description, tag) en genre propre. */
function cleanGenre(raw: string | null | undefined): string {
  const value = (raw ?? '').trim();
  if (!value || /^unknown/i.test(value)) return 'Unknown';
  for (const { re, genre } of GENRE_RULES) {
    if (re.test(value)) return genre;
  }
  if (NATIONALITY_RE.test(value.trim())) return 'International';
  const cleaned = value.replace(/\([^)]*\)/g, '').trim();
  const firstWord = cleaned.split(/[\s,;]+/)[0];
  if (firstWord) return firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
  return value;
}

/** Enlève les paramètres de suivi des URLs d'images. */
function cleanImageUrl(url: string): string {
  return url.split('?')[0];
}

/** Suffixes de titres qui ne sont manifestement pas un artiste. */
const NON_PERSON_SUFFIX =
  /\((tv series|film|video game|album|song|single|ep|mixtape|book|novel|character|episode|magazine|show|channel|company|record label)\)$/i;

/** Entrées MusicBrainz parasites. */
const JUNK_MB_NAME = /^\[.*\]$|^unknown(\s|$)|^various artists$/i;

/** Types Wikidata de GROUPES musicaux — toujours des artistes. */
const MUSICAL_GROUP_TYPES = new Set(['Q215380', 'Q1407351', 'Q2088357']);

/** Occupations musicales (P106) qui prouvent qu'un humain est un artiste. */
const MUSIC_OCCUPATIONS = new Set([
  'Q639669', 'Q483501', 'Q2252262', 'Q177220', 'Q36834', 'Q753110', 'Q205985',
  'Q855091', 'Q1289525', 'Q4610556', 'Q10816969', 'Q183945', 'Q16934228', 'Q13391348',
]);

interface MbArtist {
  id: string;
  name: string;
  type?: string;
  country?: string;
  area?: { id?: string; name?: string };
  'begin-area'?: { id?: string; name?: string };
  tags?: Array<{ name: string }>;
  'life-span'?: { begin?: string; end?: string };
  disambiguation?: string;
  relations?: Array<{ type?: string; url?: { resource?: string } }>;
}

interface WikipediaPage {
  title: string;
  qid: string;
}

/** Délai entre deux requêtes MusicBrainz (1 requête/sec autorisée). */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(() => resolve(), ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/** Extrait plateformes + réseaux sociaux depuis les relations d'un artiste. */
function extractLinks(item: MbArtist): {
  platforms: ArtistPlatforms;
  socials: ArtistSocials;
  wikipediaUrl?: string;
  wikidataId?: string;
} {
  const platforms: ArtistPlatforms = {};
  const socials: ArtistSocials = {};
  let wikipediaUrl: string | undefined;
  let wikidataId: string | undefined;
  for (const rel of item.relations ?? []) {
    const url = rel.url?.resource;
    if (!url) continue;
    const type = (rel.type ?? '').toLowerCase();
    if (type.includes('youtube')) platforms.youtube = url;
    else if (type.includes('spotify')) platforms.spotify = url;
    else if (type.includes('apple')) platforms.apple_music = url;
    else if (type.includes('bandcamp')) platforms.bandcamp = url;
    else if (type.includes('soundcloud')) platforms.soundcloud = url;
    else if (type.includes('deezer')) platforms.deezer = url;
    else if (type.includes('official homepage')) platforms.website = url;
    else if (type.includes('facebook')) socials.facebook = url;
    else if (type.includes('instagram')) socials.instagram = url;
    else if (type.includes('twitter') || type.includes('x.com')) socials.twitter = url;
    else if (type.includes('tiktok')) socials.tiktok = url;
    else if (type.includes('wikipedia')) {
      socials.wikipedia = url;
      wikipediaUrl = url;
    } else if (type.includes('wikidata') && /wiki\/Q\d+/.test(url)) {
      wikidataId = url.split('/wiki/')[1]?.split('#')[0];
    }
  }
  return { platforms, socials, wikipediaUrl, wikidataId };
}

/** Détails d'un artiste : relations, zone d'origine, type (person/group). */
async function enrichArtist(
  mbid: string,
  signal?: AbortSignal,
): Promise<{
  relations?: MbArtist['relations'];
  type?: string;
  area?: MbArtist['area'];
  'begin-area'?: MbArtist['begin-area'];
  country?: string;
  'life-span'?: MbArtist['life-span'];
}> {
  try {
    const res = await fetch(
      `https://musicbrainz.org/ws/2/artist/${mbid}?inc=url-rels+area&fmt=json`,
      { headers: { Accept: 'application/json', 'User-Agent': MUSICBRAINZ_USER_AGENT }, signal },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as MbArtist;
    return {
      relations: data.relations,
      type: data.type,
      area: data.area,
      'begin-area': data['begin-area'],
      country: data.country,
      'life-span': data['life-span'],
    };
  } catch {
    return {};
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
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      extract?: string;
      description?: string;
      originalimage?: { source?: string };
      thumbnail?: { source?: string };
    };
    const image = data.originalimage?.source ?? data.thumbnail?.source;
    return { extract: data.extract, description: data.description, image: image ? cleanImageUrl(image) : '' };
  } catch {
    return null;
  }
}

/** Bio + photo HD depuis un lien Wikipedia direct. */
async function fetchWikipediaBio(
  wikipediaUrl: string,
): Promise<{ bio: string; image: string }> {
  try {
    const title = wikipediaUrl.split('/wiki/')[1]?.split('#')[0];
    if (!title) return { bio: '', image: '' };
    const summary = await fetchWikipediaSummary(title);
    return {
      bio: (summary?.extract ?? '').trim().slice(0, 500),
      image: summary?.image ?? '',
    };
  } catch {
    return { bio: '', image: '' };
  }
}

/** Résout l'identifiant Wikidata (QID) d'une page Wikipedia. */
async function resolveWikidataId(
  wikipediaUrl: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const title = wikipediaUrl.split('/wiki/')[1]?.split('#')[0];
    if (!title) return null;
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(title)}&format=json&origin=*`,
      { signal },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> };
    };
    for (const page of Object.values(data.query?.pages ?? {})) {
      const qid = page.pageprops?.wikibase_item;
      if (qid) return qid;
    }
    return null;
  } catch {
    return null;
  }
}

/** Liens, réseaux, pays, MBID et type d'une entité depuis ses claims Wikidata. */
async function fetchWikidataArtist(
  qid: string,
  signal?: AbortSignal,
): Promise<{
  platforms: ArtistPlatforms;
  socials: ArtistSocials;
  countryQid?: string;
  mbid?: string;
  isArtist: boolean;
}> {
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`,
      { signal },
    );
    if (!res.ok) return { platforms: {}, socials: {}, isArtist: false };
    const data = (await res.json()) as {
      entities?: Record<string, { claims?: Record<string, unknown[]> }>;
    };
    const claims = data.entities?.[qid]?.claims ?? {};
    const val = (prop: string): unknown => {
      for (const c of claims[prop] ?? []) {
        try {
          const claim = c as { mainsnak?: { datavalue?: { value?: unknown } } };
          return claim.mainsnak?.datavalue?.value;
        } catch {
          /* suivant */
        }
      }
      return null;
    };

    // Anti-politicien : un humain (P31=Q5) n'est un artiste QUE s'il a une
    // occupation musicale (P106). Un groupe musical est toujours un artiste.
    const p31 = claims.P31 ?? [];
    const instanceTypes: string[] = [];
    for (const c of p31) {
      const value = (c as { mainsnak?: { datavalue?: { value?: { id?: string } } } })
        .mainsnak?.datavalue?.value?.id;
      if (value) instanceTypes.push(value);
    }
    const isGroup = instanceTypes.some((id) => MUSICAL_GROUP_TYPES.has(id));
    const isHuman = instanceTypes.includes('Q5');
    const p106 = claims.P106 ?? [];
    const occupations: string[] = [];
    for (const c of p106) {
      const value = (c as { mainsnak?: { datavalue?: { value?: { id?: string } } } })
        .mainsnak?.datavalue?.value?.id;
      if (value) occupations.push(value);
    }
    const hasMusicOccupation = occupations.some((id) => MUSIC_OCCUPATIONS.has(id));
    const isArtist = isGroup || (isHuman && hasMusicOccupation) || (!isHuman && hasMusicOccupation);

    const platforms: ArtistPlatforms = {};
    const socials: ArtistSocials = {};
    const website = val('P856');
    if (typeof website === 'string' && website) platforms.website = website;
    const yt = val('P2397');
    if (typeof yt === 'string' && yt) platforms.youtube = `https://www.youtube.com/channel/${yt}`;
    const spotify = val('P1324');
    if (typeof spotify === 'string' && spotify) platforms.spotify = `https://open.spotify.com/artist/${spotify}`;
    const insta = val('P2002');
    if (typeof insta === 'string' && insta) socials.instagram = `https://www.instagram.com/${insta}`;
    const fb = val('P2013');
    if (typeof fb === 'string' && fb) socials.facebook = `https://www.facebook.com/${fb}`;
    const tw = val('P2003');
    if (typeof tw === 'string' && tw) socials.twitter = `https://x.com/${tw}`;
    const tt = val('P7085');
    if (typeof tt === 'string' && tt) socials.tiktok = `https://www.tiktok.com/@${tt}`;
    const mbid = val('P434');
    const country = val('P27') ?? val('P495');
    return {
      platforms,
      socials,
      countryQid: (country as { id?: string } | null)?.id,
      mbid: typeof mbid === 'string' ? mbid : undefined,
      isArtist,
    };
  } catch {
    return { platforms: {}, socials: {}, isArtist: false };
  }
}

/** Libellés (français puis anglais) d'une liste d'entités Wikidata. */
async function fetchWikidataLabels(
  qids: string[],
  signal?: AbortSignal,
): Promise<Record<string, string>> {
  if (qids.length === 0) return {};
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qids.join('|')}&props=labels&languages=fr%7Cen&format=json&origin=*`,
      { signal },
    );
    if (!res.ok) return {};
    const data = (await res.json()) as {
      entities?: Record<string, { labels?: Record<string, { value?: string }> }>;
    };
    const out: Record<string, string> = {};
    for (const [id, entity] of Object.entries(data.entities ?? {})) {
      const label = entity.labels?.fr?.value ?? entity.labels?.en?.value;
      if (label) out[id] = label;
    }
    return out;
  } catch {
    return {};
  }
}

/** Recherche des pages Wikipedia avec leur ID Wikidata, sans homonymies. */
async function searchWikipediaPages(
  query: string,
  signal?: AbortSignal,
): Promise<WikipediaPage[]> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=10&prop=pageprops%7Cinfo&format=json&origin=*`,
      { signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: {
        pages?: Record<
          string,
          { title?: string; pageprops?: { disambiguation?: string; wikibase_item?: string } }
        >;
      };
    };
    return Object.values(data.query?.pages ?? {})
      .filter((p) => p.title && p.pageprops?.wikibase_item && !p.pageprops.disambiguation)
      .map((p) => ({ title: p.title as string, qid: p.pageprops?.wikibase_item as string }));
  } catch {
    return [];
  }
}

/** Cherche directement sur Wikidata (artistes sans page Wikipedia). */
async function searchWikidataEntities(
  query: string,
  signal?: AbortSignal,
): Promise<WikipediaPage[]> {
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=fr&uselang=fr&type=item&limit=5&format=json&origin=*`,
      { signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { search?: Array<{ id?: string; label?: string }> };
    return (data.search ?? [])
      .filter((e) => e.id?.startsWith('Q') && e.label)
      .map((e) => ({ title: e.label as string, qid: e.id as string }))
      .slice(0, 5);
  } catch {
    return [];
  }
}

/** Bio + photo via Wikidata (sitelinks → Wikipedia EN/FR). */
async function wikipediaFromWikidata(
  wikidataId: string,
): Promise<{ bio: string; image: string }> {
  try {
    const res = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=sitelinks&sitefilter=enwiki|frwiki&format=json&origin=*`,
    );
    if (!res.ok) return { bio: '', image: '' };
    const data = (await res.json()) as {
      entities?: Record<string, { sitelinks?: Record<string, { title?: string }> }>;
    };
    const links = data.entities?.[wikidataId]?.sitelinks;
    const title = links?.enwiki?.title ?? links?.frwiki?.title;
    if (!title) return { bio: '', image: '' };
    const summary = await fetchWikipediaSummary(title);
    return {
      bio: (summary?.extract ?? '').trim().slice(0, 500),
      image: summary?.image ?? '',
    };
  } catch {
    return { bio: '', image: '' };
  }
}

/**
 * Recherche MusicBrainz (artiste, alias, genre, lieu) avec enrichissement
 * (plateformes, réseaux, vraie bio Wikipedia, photo HD, anti-politicien).
 * Même logique que le web → résultats identiques sur mobile et web.
 */
async function searchMusicBrainz(query: string, signal?: AbortSignal): Promise<DiscoveredArtist[]> {
  const term = /[\s-]/.test(query) ? `"${query}"` : query;
  const escaped = encodeURIComponent(term);

  const runQuery = async (field: string): Promise<MbArtist[]> => {
    const url =
      `https://musicbrainz.org/ws/2/artist/?query=${field}:${escaped}&fmt=json&limit=8`;
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': MUSICBRAINZ_USER_AGENT },
        signal,
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { artists?: MbArtist[] };
      return data.artists ?? [];
    } catch {
      return [];
    }
  };

  const artistHits = await runQuery('artist');
  let aliasHits: MbArtist[] = [];
  let tagHits: MbArtist[] = [];
  let areaHits: MbArtist[] = [];
  if (artistHits.length < 3 && !signal?.aborted) {
    await sleep(400, signal);
    aliasHits = await runQuery('alias');
  }
  if (artistHits.length < 2 && !signal?.aborted) {
    await sleep(400, signal);
    tagHits = await runQuery('tag');
    await sleep(400, signal);
    areaHits = await runQuery('area');
  }

  const seen = new Set<string>();
  const ordered: MbArtist[] = [];
  for (const list of [artistHits, aliasHits, tagHits, areaHits]) {
    for (const item of list) {
      if (!item.id || seen.has(item.id) || JUNK_MB_NAME.test(item.name)) continue;
      seen.add(item.id);
      ordered.push(item);
    }
  }

  const out: DiscoveredArtist[] = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const item = ordered[i];
    await sleep(i === 0 ? 1200 : 600, signal);
    if (signal?.aborted) break;
    const enriched = await enrichArtist(item.id, signal);
    const relations = enriched.relations ?? item.relations;
    const { platforms, socials, wikipediaUrl, wikidataId } = extractLinks({
      ...item,
      relations,
    });

    let qid = wikidataId ?? null;
    if (!qid && wikipediaUrl && !signal?.aborted) {
      qid = await resolveWikidataId(wikipediaUrl, signal);
    }
    if (qid && !signal?.aborted) {
      const wd = await fetchWikidataArtist(qid, signal);
      if (!wd.isArtist && !wd.mbid) continue;
    }

    let bio =
      [item.disambiguation, item['life-span']?.begin ? `Active since ${item['life-span'].begin}.` : '']
        .filter(Boolean).join(' ') || '';
    let image = '';
    if (wikipediaUrl) {
      const wiki = await fetchWikipediaBio(wikipediaUrl);
      if (wiki.bio) bio = wiki.bio;
      image = wiki.image;
    } else if (qid) {
      const wiki = await wikipediaFromWikidata(qid);
      if (wiki.bio) bio = wiki.bio;
      image = wiki.image;
    }
    if (!bio) bio = 'Artist found on Musibrainz.';

    const country = enriched.country ?? item.country ?? enriched.area?.name ?? '';
    const rawCity =
      enriched['begin-area']?.name ?? enriched.area?.name ?? item.area?.name ?? '';
    // Pays pris pour une ville (« Nigeria ») → city vide (même règle web).
    const city = rawCity && countryByName(rawCity) ? '' : rawCity;
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
      type: enriched.type ?? item.type,
    });
  }
  return out;
}

/** Secours Wikipedia + Wikidata : artistes absents de MusicBrainz. */
async function searchWikipediaFallback(
  query: string,
  signal?: AbortSignal,
): Promise<DiscoveredArtist[]> {
  let pages = await searchWikipediaPages(query, signal);
  let source: 'wikipedia' | 'wikidata' = 'wikipedia';
  if (pages.length === 0 && !signal?.aborted) {
    pages = await searchWikidataEntities(query, signal);
    source = 'wikidata';
  }
  pages = pages.filter((p) => !NON_PERSON_SUFFIX.test(p.title)).slice(0, 5);
  if (pages.length === 0) return [];

  const enriched: Array<{
    page: WikipediaPage;
    summary: { extract?: string; description?: string; image?: string } | null;
    wd: {
      platforms: ArtistPlatforms;
      socials: ArtistSocials;
      countryQid?: string;
      mbid?: string;
      isArtist: boolean;
    };
  }> = [];
  for (const page of pages) {
    if (signal?.aborted) break;
    const [summary, wd] = await Promise.all([
      fetchWikipediaSummary(page.title, signal),
      fetchWikidataArtist(page.qid, signal),
    ]);
    if (!wd.isArtist && !wd.mbid) continue;
    enriched.push({ page, summary, wd });
  }

  const countryQids = [
    ...new Set(enriched.map((e) => e.wd.countryQid).filter((x): x is string => Boolean(x))),
  ];
  const countryLabels = await fetchWikidataLabels(countryQids, signal);

  const out: DiscoveredArtist[] = [];
  for (const { page, summary, wd } of enriched) {
    if (signal?.aborted) break;
    const name = page.title.replace(/\s*\([^)]*\)\s*$/, '').trim();
    const bio =
      (summary?.extract ?? '').trim().slice(0, 500) ||
      (source === 'wikipedia' ? 'Artiste trouvé sur Wikipedia.' : 'Artiste trouvé sur Wikidata.');
    const country = wd.countryQid ? (countryLabels[wd.countryQid] ?? '') : '';
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
    });
  }
  return out;
}

interface AiVerdict {
  id?: string;
  verdict?: string;
  reason?: string;
  genre?: string;
  bio?: string;
}

/** Cache court des verdicts IA par artiste (10 min, session). On ne cache
 *  QUE les « keep » — jamais un rejet (faux positif ne condamne pas). */
const aiVerdictCache = new Map<string, { at: number; genre: string; bio: string }>();
const AI_CACHE_TTL_MS = 10 * 60 * 1000;

function cachedVerdict(artist: DiscoveredArtist): Partial<AiVerdict> | null {
  const entry = aiVerdictCache.get(artist.id);
  if (!entry || Date.now() - entry.at > AI_CACHE_TTL_MS) return null;
  return { verdict: 'keep', genre: entry.genre, bio: entry.bio };
}

/** Cache par requête (10 min) pour ne pas brûler le budget Mistral. */
const agentQueryCache = new Map<string, { at: number; artist: DiscoveredArtist | null }>();
const AGENT_QUERY_TTL_MS = 10 * 60 * 1000;

/** Repli « agent à outils » (edge function ai_artist_agent, prod). */
async function agentDeepSearch(query: string): Promise<DiscoveredArtist | null> {
  if (!hasSupabase) return null;
  const cacheKey = query.trim().toLowerCase();
  const cached = agentQueryCache.get(cacheKey);
  if (cached && Date.now() - cached.at <= AGENT_QUERY_TTL_MS) return cached.artist;
  const invoke = supabase!.functions.invoke('ai_artist_agent', {
    body: { query, maxSteps: 8 },
  });
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 9000));
  const out = (await Promise.race([invoke, timeout])) as
    | {
        data?: {
          status?: string;
          candidate?: {
            id?: string;
            name?: string;
            genre?: string;
            country?: string;
            city?: string;
            bio?: string;
            image?: string;
            lat?: number;
            lng?: number;
          };
          verdict?: { verdict?: string; genre?: string; bio?: string };
        };
      }
    | 'timeout';
  let result: DiscoveredArtist | null = null;
  if (out !== 'timeout' && out.data) {
    const data = out.data;
    const candidate = data.candidate;
    if (
      candidate?.name &&
      data.status !== 'empty' &&
      data.status !== 'rejected' &&
      data.verdict?.verdict !== 'reject'
    ) {
      const name = candidate.name;
      const country = candidate.country ?? '';
      const rawCity = candidate.city ?? '';
      const city = rawCity && countryByName(rawCity) ? '' : rawCity;
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
      };
    }
  }
  agentQueryCache.set(cacheKey, { at: Date.now(), artist: result });
  return result;
}

/** Vérification IA des candidats (edge function ai_verify → Mistral). */
async function aiVerifyCandidates(
  artists: DiscoveredArtist[],
): Promise<DiscoveredArtist[] | null> {
  if (!hasSupabase || artists.length === 0) return null;
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
        links: [...Object.values(a.platforms ?? {}), ...Object.values(a.socials ?? {})].filter(Boolean),
      })),
    },
  });
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 6000));
  const out = (await Promise.race([invoke, timeout])) as
    | { data?: { results?: AiVerdict[] }; error?: { message?: string } }
    | 'timeout';
  if (out === 'timeout' || !out.data?.results) return null;
  const byId = new Map((out.data.results ?? []).map((r) => [r.id, r]));
  const kept: DiscoveredArtist[] = [];
  for (const artist of artists) {
    const cached = cachedVerdict(artist);
    const verdict = cached ?? byId.get(artist.id);
    // Un artiste SANS verdict (non révisé) est conservé tel quel — seul un
    // rejet EXPLICITE de l'IA le retire. Gating Musibrainz : si l'IA juge
    // que ce n'est pas un musicien, on ne propose plus d'ajout/revendication.
    if (!verdict) {
      kept.push(artist);
      continue;
    }
    if (verdict.verdict === 'reject') continue;
    const genre = verdict.genre && verdict.genre !== artist.genre ? verdict.genre : artist.genre;
    const bio = verdict.bio && verdict.bio.length >= 40 ? verdict.bio : artist.bio;
    if (cached) {
      kept.push({ ...artist, genre, bio });
      continue;
    }
    if (verdict.verdict === 'keep') {
      aiVerdictCache.set(artist.id, { at: Date.now(), genre, bio });
    }
    kept.push({ ...artist, genre, bio });
  }
  // `null` = vérification indisponible (dégradation silencieuse) ;
  // `[]` = tous rejetés → la recherche en ligne est vide (gating Brainz).
  return kept.length > 0 ? kept : [];
}

/**
 * Recherche en ligne multi-sources : MusicBrainz d'abord, complété par
 * Wikipedia + Wikidata, puis l'agent à outils et la vérification IA — le
 * MÊME pipeline que le web (résultats identiques web ⇄ mobile).
 */
export async function searchArtistOnline(
  query: string,
  signal?: AbortSignal,
): Promise<DiscoveredArtist[]> {
  const q = query.trim();
  if (!q) return [];

  const mbResults = await searchMusicBrainz(q, signal);

  let fallback: DiscoveredArtist[] = [];
  if (mbResults.length < 3 && !signal?.aborted) {
    fallback = await searchWikipediaFallback(q, signal);
  }

  const seen = new Set<string>();
  const merged: DiscoveredArtist[] = [];
  for (const artist of [...mbResults, ...fallback]) {
    const key = artist.name.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(artist);
  }

  for (const artist of merged) {
    const isGeneric =
      !artist.bio ||
      artist.bio === 'Artist found on Musibrainz.' ||
      (artist.bio.length < 60 && artist.bio.includes('Active since'));
    if (!isGeneric) continue;
    const match = fallback.find(
      (f) => f.name.trim().toLowerCase() === artist.name.trim().toLowerCase(),
    );
    if (!match) continue;
    if (match.bio) artist.bio = match.bio;
    if (match.image && !artist.image) artist.image = match.image;
    if (Object.keys(match.platforms ?? {}).length) {
      artist.platforms = { ...artist.platforms, ...match.platforms };
    }
    if (Object.keys(match.socials ?? {}).length) {
      artist.socials = { ...artist.socials, ...match.socials };
    }
  }

  const hasRealBio = merged.some(
    (m) => m.bio && m.bio.length > 60 && !m.bio.includes('Musibrainz'),
  );
  if (!signal?.aborted && (merged.length < 3 || !hasRealBio)) {
    try {
      const deep = await agentDeepSearch(q);
      const already =
        deep && merged.some((m) => m.name.trim().toLowerCase() === deep.name.trim().toLowerCase());
      if (deep && !already) merged.push(deep);
    } catch {
      /* on garde la recherche de base */
    }
  }
  if (signal?.aborted) return merged;
  try {
    const verified = await aiVerifyCandidates(merged);
    // `verified === null` → vérification indisponible : on garde le brut.
    // `verified === []` → l'IA a rejeté les candidats (non-musiciens) : on
    //   ne montre AUCUNE section en ligne ni bouton ajout/revendication.
    if (verified && verified.length > 0) return verified;
    if (verified !== null) return [];
  } catch {
    /* on garde le résultat brut */
  }
  return merged;
}

/** Normalise un pays (nom/code) en code ISO alpha-2. */
function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  const byName = countryByName(s);
  if (byName) return byName.code;
  const strip = (v: string) =>
    v
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const k = strip(s);
  const variants: Record<string, string> = {
    'cote d ivoire': 'CI', 'cote divoire': 'CI', 'ivoire coast': 'CI',
    'republique democratique du congo': 'CD', rdc: 'CD', 'congo dr': 'CD', 'dr congo': 'CD',
    'etats unis': 'US', 'united states': 'US', usa: 'US', 'u s a': 'US',
    'royaume uni': 'GB', 'united kingdom': 'GB', angleterre: 'GB',
    'cap vert': 'CV', 'pays bas': 'NL', 'coree du sud': 'KR', 'coree du nord': 'KP',
    'emirats arabes unis': 'AE', 'arabie saoudite': 'SA',
  };
  if (variants[k]) return variants[k];
  return null;
}

/** Code pays du contexte d'un résultat Mapbox (short_code « bj », « fr-75 »…). */
function countryCodeOfFeature(feature: { context?: Array<{ id?: string; short_code?: string }> }): string | null {
  const c = (feature.context ?? []).find((x) => (x.id ?? '').startsWith('country'));
  const sc = c?.short_code ?? '';
  const code = sc.replace(/^[a-z]{2}-/, '').toUpperCase();
  return code.length === 2 ? code : null;
}

interface GeocodeResult {
  lng: number;
  lat: number;
  country?: string;
}

async function geocodePlace(
  place: string,
  expectedCountry?: string | null,
): Promise<GeocodeResult | null> {
  if (!MAPBOX_TOKEN || !place.trim()) return null;
  try {
    const countryCode = normalizeCountryCode(expectedCountry);
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(place)}.json` +
      // neighborhood : le quartier est géocodé aussi (pins dispersés par
      // quartier au lieu du centre-ville).
      `?access_token=${MAPBOX_TOKEN}&limit=3&types=place,region,locality,neighborhood` +
      (countryCode ? `&country=${countryCode}` : '');
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      features?: Array<{ center?: [number, number]; context?: Array<{ id?: string; short_code?: string }> }>;
    };
    for (const feature of data.features ?? []) {
      const center = feature.center;
      if (!center || center.length !== 2) continue;
      if (countryCode) {
        const real = countryCodeOfFeature(feature);
        if (real && real !== countryCode) continue;
      }
      const resolved = countryCodeOfFeature(feature);
      return {
        lng: center[0],
        lat: center[1],
        country: countryCode ?? resolved ?? undefined,
      };
    }
    return null;
  } catch {
    return null;
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
 * Recherche de QUARTIERS (et localités) via Mapbox geocoding — mêmes types
 * que le web (neighborhood, locality, place) pour des résultats identiques.
 */
export async function searchNeighborhoods(
  query: string,
  signal?: AbortSignal,
): Promise<NeighborhoodSuggestion[]> {
  const q = query.trim();
  if (!MAPBOX_TOKEN || q.length < 2) return [];
  try {
    // « place » est exclu : les villes sont déjà couvertes par placeResults
    // (Lieux) — on ne veut que les QUARTIERS / localités ici, sans doublon.
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN!,
      limit: '5',
      types: 'neighborhood,locality',
      language: 'fr',
    });
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`,
      { signal },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features?: Array<{
        text?: string;
        place_name?: string;
        center?: [number, number];
        context?: Array<{ id?: string; short_code?: string; text?: string }>;
      }>;
    };
    const out: NeighborhoodSuggestion[] = [];
    for (const feature of data.features ?? []) {
      const center = feature.center;
      if (!center || center.length !== 2 || !feature.text) continue;
      const ctx = feature.context ?? [];
      const place = ctx.find((x) => (x.id ?? '').startsWith('place'));
      const country = ctx.find((x) => (x.id ?? '').startsWith('country'));
      const countryCode = countryCodeOfFeature(feature);
      out.push({
        name: feature.text,
        city: place?.text ?? '',
        country: country?.text ?? '',
        countryCode,
        lng: center[0],
        lat: center[1],
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Suggestion de villes (Mapbox Geocoding) pour les formulaires (inscription…). */
export async function suggestCities(
  query: string,
  countryCode?: string | null,
): Promise<Array<{ city: string; label: string; lng: number; lat: number; countryCode: string | null }>> {
  const q = query.trim();
  if (!MAPBOX_TOKEN || q.length < 2) return [];
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      limit: '6',
      types: 'place,locality',
      language: 'fr',
    });
    if (countryCode && /^[A-Za-z]{2}$/.test(countryCode)) {
      params.set('country', countryCode);
    }
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?${params}`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features?: Array<{
        text?: string;
        place_name?: string;
        center?: [number, number];
        context?: Array<{ id?: string; short_code?: string }>;
      }>;
    };
    return (data.features ?? [])
      .map((feature) => {
        const center = feature.center;
        if (!center || center.length !== 2 || !feature.text) return null;
        return {
          city: feature.text,
          label: feature.place_name ?? feature.text,
          lng: center[0],
          lat: center[1],
          countryCode: countryCodeOfFeature(feature),
        };
      })
      .filter((x): x is { city: string; label: string; lng: number; lat: number; countryCode: string | null } => x !== null);
  } catch {
    return [];
  }
}

/** Localise un candidat déjà trouvé (géocodage Mapbox, pays filtré + vérifié). */
export async function locateArtist(artist: DiscoveredArtist): Promise<{
  artist?: DiscoveredArtist;
  error?: string;
}> {
  if (!artist.city?.trim()) return { artist, error: 'no-location' };
  // Le quartier est géocodé en priorité (« Yopougon, Abidjan, CI ») : le pin
  // atterrit dans le vrai quartier et deux artistes d'une même ville mais de
  // quartiers différents ne s'empilent jamais sur le centre-ville.
  const place = [artist.district, artist.city, artist.country]
    .filter((v) => v && v.trim())
    .join(', ');
  const coords = await geocodePlace(place, artist.country);
  if (!coords) return { artist, error: 'no-location' };
  // Le pays GÉOGRAPHIQUE résolu par le géocodage prime (parité web) : le pays
  // déclaré (origine MusicBrainz) ne doit pas écraser la vraie localisation,
  // sinon un artiste d'origine US installé à Johannesburg formerait un
  // cluster « US » fantôme au-dessus de l'Afrique du Sud.
  const countryCode = coords.country ?? normalizeCountryCode(artist.country);
  return {
    artist: {
      ...artist,
      lng: coords.lng,
      lat: coords.lat,
      country: countryCode ?? artist.country ?? '',
      flag: countryCode ? flagFor(countryCode) : artist.flag,
    },
  };
}

/** Ajoute un artiste découvert à la carte (upsert enrichi, table partagée). */
export async function addMapArtist(artist: DiscoveredArtist): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!hasSupabase) return { ok: false, error: 'supabase-missing' };
  if (!artist.lat || !artist.lng) {
    return { ok: false, error: 'no-location' };
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
  };
  let { error } = await supabase!.from('map_artists').upsert(
    {
      ...payload,
      platforms: artist.platforms ?? {},
      socials: artist.socials ?? {},
      verified: artist.verified ?? false,
      claimed_by: artist.claimedBy ?? null,
    },
    { onConflict: 'id' },
  );
  if (error && /platforms|socials|verified|claimed_by|image/i.test(error.message)) {
    const retry = await supabase!.from('map_artists').upsert(payload, { onConflict: 'id' });
    error = retry.error;
  }
  return error ? { ok: false, error: 'error' } : { ok: true };
}

/**
 * Ajoute OU met à jour un artiste via le RPC sécurisé add_or_update_map_artist
 * (même chemin que le web) : enrichit le profil existant sans toucher à la
 * modération, et notifie les utilisateurs concernés en cas de nouvel artiste.
 */
export async function addOrUpdateMapArtist(artist: DiscoveredArtist): Promise<{
  ok: boolean;
  error?: string;
  id?: string;
  updated?: boolean;
}> {
  if (!hasSupabase) return { ok: false, error: 'supabase-missing' };
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
    },
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string; id?: string; updated?: boolean } | null;
  if (!result?.ok) return { ok: false, error: result?.error ?? 'unknown' };
  if (result.updated !== true) {
    try {
      await supabase!.rpc('notify_discovery', {
        p_artist_id: artist.id,
        p_artist_name: artist.name,
        p_genre: artist.genre ?? '',
        p_city: artist.city ?? '',
        p_country: artist.country ?? '',
      });
    } catch {
      /* silencieux */
    }
  }
  return { ok: true, id: result.id, updated: result.updated };
}

/** Corrige les informations d'un artiste découvert (admin ou propriétaire). */
export async function updateMapArtist(
  id: string,
  patch: Partial<{
    name: string;
    genre: string;
    city: string;
    district: string;
    country: string;
    flag: string;
    lat: number;
    lng: number;
    bio: string;
    image: string;
    cover: string;
    platforms: ArtistPlatforms;
    socials: ArtistSocials;
    verified: boolean;
  }>,
  opts?: { skipGenreClean?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase) return { ok: false, error: 'supabase-missing' };
  if (patch.genre !== undefined && !opts?.skipGenreClean) patch.genre = cleanGenre(patch.genre);
  let { error } = await supabase!.from('map_artists').update(patch).eq('id', id);
  if (error && /platforms|socials|verified|claimed_by|image|cover/i.test(error.message)) {
    const { platforms: _p, socials: _s, image: _i, cover: _c, ...base } = patch;
    const retry = await supabase!.from('map_artists').update(base).eq('id', id);
    error = retry.error;
  }
  return error ? { ok: false, error: 'error' } : { ok: true };
}

/** Demande la revendication d'un profil de la carte (artiste connecté). */
export async function requestClaim(
  mapArtistId: string,
  note?: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase) return { ok: false, error: 'supabase-missing' };
  const { data, error } = await supabase!.rpc('request_claim', {
    p_map_artist_id: mapArtistId,
    p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? 'unknown' };
}

/** Charge les artistes déjà ajoutés à la carte (table partagée web + mobile). */
export async function fetchMapArtists(): Promise<DiscoveredArtist[]> {
  if (!hasSupabase) return [];    const RICH_SELECT =
    'id, name, genre, city, district, country, flag, lat, lng, bio, image, source, platforms, socials, verified, claimed_by, events, followers';
  const BASE_SELECT = 'id, name, genre, city, district, country, flag, lat, lng, bio, image, source';
  const rich = await supabase!
    .from('map_artists')
    .select(RICH_SELECT)
    .order('created_at', { ascending: false })
    .limit(500);
  let rows = rich.data ?? null;
  if (rich.error || !rows) {
    const fallback = await supabase!
      .from('map_artists')
      .select(BASE_SELECT)
      .order('created_at', { ascending: false })
      .limit(500);
    rows = (fallback.data ?? null) as unknown as typeof rows;
  }
  if (!rows) return [];
  return (rows as unknown as Array<Record<string, unknown>>)
    .filter((row) => typeof row.lat === 'number' && typeof row.lng === 'number')
    .map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ''),
      genre: String(row.genre ?? 'Unknown'),
      city: String(row.city ?? ''),
      district: row.district ? String(row.district) : undefined,
      country: String(row.country ?? ''),
      flag: String(row.flag ?? '🌍'),
      lat: row.lat as number,
      lng: row.lng as number,
      bio: String(row.bio ?? ''),
      image: row.image ? String(row.image) : undefined,
      source: String(row.source ?? 'musicbrainz'),
      platforms: (row.platforms ?? {}) as ArtistPlatforms,
      socials: (row.socials ?? {}) as ArtistSocials,
      verified: Boolean(row.verified),
      claimedBy: row.claimed_by ? String(row.claimed_by) : null,
      events: (row.events ?? []) as ArtistEvent[],
      followers: row.followers ? String(row.followers) : '',
    }));
}

/** Supprime un artiste découvert de la carte. */
export async function removeMapArtist(id: string): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase) return { ok: false, error: 'supabase-missing' };
  const { error } = await supabase!.from('map_artists').delete().eq('id', id);
  return error ? { ok: false, error: 'error' } : { ok: true };
}

/** Convertit un artiste découvert en type Artist (pour la carte / fiches). */
export function toArtist(d: DiscoveredArtist): Artist {
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
  };
}
