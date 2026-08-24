/**
 * Récupération automatique des titres d'un artiste depuis l'iTunes Search
 * API (Apple Music) — publique, sans clé. La durée et le preview audio
 * (30 s) permettent de peupler l'onglet « Musiques » sans intervention.
 *
 * **Source unique, volontairement.** Web et mobile lisent tous deux ce
 * module : toute source qui ne fonctionne que d'un côté (CORS, SDK natif)
 * fait diverger les deux fiches du même artiste. Avant d'en ajouter une,
 * vérifier qu'elle répond depuis un navigateur *et* depuis React Native.
 */

export interface StreamedTrack {
  title: string
  album: string
  duration: string
  artwork: string
  url: string
  previewUrl?: string
}

interface ItunesResult {
  trackName?: string
  artistName?: string
  collectionName?: string
  trackTimeMillis?: number
  artworkUrl100?: string
  trackViewUrl?: string
  previewUrl?: string
}

/**
 * Ligatures et lettres barrées que NFD ne décompose pas : sans cette table
 * elles tombent dans le filtre `[^a-z0-9]` et disparaissent du nom.
 * « Le 3ème Œil » deviendrait « le 3eme il » et ne matcherait jamais
 * « Le 3ème Oeil », l'orthographe retenue par iTunes.
 */
const LIGATURES: Record<string, string> = {
  œ: 'oe',
  æ: 'ae',
  ø: 'o',
  ß: 'ss',
  ł: 'l',
  đ: 'd',
  ð: 'd',
  þ: 'th',
}

/**
 * Normalise un nom pour comparaison approximative (minuscules, sans accents).
 * Exportée pour être testée : c'est elle qui décide si un artiste retrouve
 * ses titres, et ses pièges (ligatures) ne se voient pas à la lecture.
 */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[œæøßłđðþ]/g, (c) => LIGATURES[c] ?? c)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Homonymes désambiguïsés qu'iTunes renvoie (tribute, cover, toon…). */
const AMBIGUOUS_ARTIST = /\((tribute|cover|toon|karaoke|remix|live|band|trio|duo|project|official|original|club|dj)\)/i

/** Nombre de titres renvoyés par défaut à l'appelant. */
const DEFAULT_TRACK_LIMIT = 24

/** Titres demandés à iTunes avant filtrage : la moisson est large, le tri sévère. */
const ITUNES_SEARCH_LIMIT = 50

/**
 * Longueur minimale d'un crédit pour qu'il puisse valider un nom plus long
 * (« Sade » → « Sade Adu »). En dessous, le risque d'homonymie l'emporte.
 */
const MIN_PARTIAL_CREDIT_LENGTH = 4

/** Fraîcheur d'une liste de titres trouvée. */
const TRACK_CACHE_TTL_MS = 60 * 60 * 1000

/**
 * Fraîcheur d'un résultat vide. Plus courte que celle d'un succès : l'artiste
 * peut apparaître sur la plateforme entre-temps. Mais mémoriser l'échec est
 * indispensable — sans lui, chaque ouverture de fiche d'un artiste introuvable
 * re-frappe iTunes et consomme le quota (~20 requêtes/min).
 */
const EMPTY_CACHE_TTL_MS = 10 * 60 * 1000

/**
 * Collectifs / alias connus par artiste : iTunes crédite certains titres au
 * collectif (« Bakel City Gang », « 92i ») plutôt qu'à l'artiste lui-même.
 * On accepte ces crédits comme s'il s'agissait de l'artiste.
 */
const KNOWN_GROUPS: Record<string, string[]> = {
  booba: ['bakel city gang', '92i', '92i veyron', '92i gang'],
  ninho: ['gotham'],
  damso: ['qalif'],
}

/**
 * Découpe un crédit artiste en participants (collabs) :
 * « Booba feat. Siboy & Benash » → [booba, siboy, benash]
 * « La Fouine & Booba » → [la fouine, booba]
 * « Booba x Siboy » → [booba, siboy]
 * Seuls les tokens autonomes (avec espaces autour) sont des séparateurs :
 * « x » dans « XXXTentacion » ou « and » dans « The Andrew Sisters » ne
 * découpent jamais un nom.
 */
function creditedArtists(trackArtist: string): string[] {
  // Le découpage se fait sur la chaîne BRUTE : `normalize` réduit « & » et
  // « , » à des espaces, ce qui effacerait justement les séparateurs.
  // « La Fouine & Booba » devenait « la fouine booba », un seul participant,
  // et l'artiste cherché n'était jamais reconnu dans ses propres collabs.
  const WORD_SEPARATORS = /\s+(?:feat\.?|ft\.?|duet with|featuring|with|and|avec|vs\.?|x)\s+|\s*&\s*/i
  // La virgule ne sépare que dans une énumération avérée (« A, B & C ») :
  // seule, elle couperait « Tyler, The Creator » en deux artistes.
  const isEnumeration = /\s&\s|\s(?:feat\.?|ft\.?|featuring|avec|and)\s/i.test(trackArtist)
  const parts = trackArtist.split(WORD_SEPARATORS)
  const pieces = isEnumeration ? parts.flatMap((p) => p.split(',')) : parts
  return pieces.map((part) => normalize(part)).filter(Boolean)
}

/**
 * Les résultats iTunes peuvent contenir des homonymes (« Booba (toon) »),
 * des reprises ou des artistes crédités différemment. On accepte un titre si
 * l'artiste cherché apparaît parmi les participants (collab) ou si le crédit
 * est un collectif/alias connu de cet artiste.
 */
export function matchesArtist(trackArtist: string, artistName: string): boolean {
  if (AMBIGUOUS_ARTIST.test(trackArtist)) return false
  const a = normalize(artistName)
  if (!a) return false
  const b = normalize(trackArtist)
  if (!b) return false
  // Nom exact → accepté.
  if (b === a) return true
  // Collectif/alias connu de l'artiste (Bakel City Gang, 92i pour Booba…).
  const groups = KNOWN_GROUPS[a]
  if (groups?.includes(b)) return true
  // Collab : l'artiste est crédité parmi les participants du titre.
  if (creditedArtists(trackArtist).includes(a)) return true
  // « Booba » cherché, artiste « Booba feat. X » : le premier mot est Booba.
  const firstWord = b.split(' ')[0]
  if (a.split(' ').length === 1 && firstWord === a) return true
  // Nom multi-mots : l'artiste doit commencer par le nom complet.
  if (a.split(' ').length > 1 && b.startsWith(a)) return true
  // Sens inverse : la carte porte un nom plus complet que le crédit de la
  // plateforme (« Sade Adu » sur la carte, « Sade » chez iTunes).
  // Deux garde-fous contre les faux positifs : le crédit doit être assez long
  // pour discriminer (« Jo » ne doit pas capter « Jo Maka ») et il ne peut
  // manquer qu'un seul mot au nom cherché.
  if (
    b.length >= MIN_PARTIAL_CREDIT_LENGTH &&
    a.split(' ').length === b.split(' ').length + 1 &&
    a.startsWith(`${b} `)
  )
    return true
  return false
}

/**
 * Plateformes d'écoute, de la plus à la moins spécifique à la musique.
 * Un lien Spotify vaut mieux qu'un site personnel pour écouter un morceau.
 */
const LISTEN_PLATFORMS = [
  'spotify',
  'apple_music',
  'deezer',
  'youtube',
  'soundcloud',
  'bandcamp',
] as const

/**
 * Où mène le bouton « écouter » d'un titre.
 *
 * Trois destinations, par ordre de précision décroissante :
 *
 *  1. l'URL du titre lui-même, quand la source en fournit une — c'est le
 *     morceau exact, rien ne fait mieux ;
 *  2. la page de l'artiste sur une plateforme d'écoute qu'il a lui-même
 *     renseignée — autoritatif, contrairement à une recherche ;
 *  3. une recherche Apple Music, en dernier recours.
 *
 * Les titres du catalogue éditorial n'ont qu'un nom et une durée : ils
 * tombaient donc systématiquement sur la recherche, alors que l'artiste avait
 * souvent son Spotify renseigné juste à côté.
 */
export function trackListenUrl(
  track: { title: string; url?: string },
  artist: { name: string; platforms?: Partial<Record<string, string>> },
): string {
  if (track.url) return track.url
  const platforms = artist.platforms ?? {}
  for (const key of LISTEN_PLATFORMS) {
    const url = platforms[key]
    if (url) return url
  }
  return appleMusicSearchUrl(artist.name, track.title)
}

/**
 * Lien d'écoute de repli pour un titre du catalogue éditorial : celui-ci ne
 * porte qu'un titre et une durée, jamais d'URL. La recherche Apple Music est
 * la destination commune aux trois écrans qui listent ces titres.
 */
export function appleMusicSearchUrl(artistName: string, trackTitle: string): string {
  return `https://music.apple.com/search?term=${encodeURIComponent(`${artistName} ${trackTitle}`)}`
}

/** Convertit une durée en millisecondes vers « m:ss ». */
function formatDuration(ms?: number): string {
  if (!ms || ms <= 0) return '—'
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Cache en mémoire : l'API iTunes publique est limitée (~20 requêtes/min).
// On évite de re-frapper le service à chaque ouverture de fiche.
const trackCache = new Map<string, StreamedTrack[]>()

/**
 * Cherche les titres d'un artiste sur iTunes/Apple Music.
 * Retourne une liste triée par pertinence, limitée à `limit` résultats.
 * Résultats mis en cache par nom d'artiste (fraîcheur : 1 h).
 */
export async function fetchArtistTracks(
  artistName: string,
  signal?: AbortSignal,
  limit = DEFAULT_TRACK_LIMIT,
): Promise<StreamedTrack[]> {
  const name = artistName.trim()
  if (!name) return []
  const cached = trackCache.get(name)
  if (cached) return cached.slice(0, limit)
  try {
    const url =
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}` +
      `&entity=song&media=music&limit=${ITUNES_SEARCH_LIMIT}`
    const res = await fetch(url, { signal })
    if (!res.ok) return []
    const data = (await res.json()) as { results?: ItunesResult[] }
    const tracks: StreamedTrack[] = []
    const seen = new Set<string>()
    for (const r of data.results ?? []) {
      if (!r.trackName || !r.artistName) continue
      if (!matchesArtist(r.artistName, name)) continue
      const key = normalize(r.trackName)
      if (seen.has(key)) continue
      seen.add(key)
      // Artwork HD (600 px) plutôt que la vignette 100 px.
      const artwork = r.artworkUrl100
        ? r.artworkUrl100.replace('100x100bb', '600x600bb')
        : ''
      tracks.push({
        title: r.trackName,
        album: r.collectionName ?? '',
        duration: formatDuration(r.trackTimeMillis),
        artwork,
        url: r.trackViewUrl ?? `https://music.apple.com/search?term=${encodeURIComponent(r.trackName)}`,
        previewUrl: r.previewUrl,
      })
      if (tracks.length >= limit) break
    }
    // Le vide est mémorisé comme le plein : c'est justement l'artiste
    // introuvable qui, sans cache, re-frappe l'API à chaque ouverture.
    trackCache.set(name, tracks)
    setTimeout(
      () => trackCache.delete(name),
      tracks.length > 0 ? TRACK_CACHE_TTL_MS : EMPTY_CACHE_TTL_MS,
    )
    return tracks
  } catch {
    // Annulation ou panne réseau : surtout ne rien mémoriser, la prochaine
    // ouverture de la fiche doit pouvoir réessayer.
    return []
  }
}

/**
 * Charge les titres d'un artiste en protégeant l'appelant des réponses
 * périmées, et retourne la fonction d'annulation.
 *
 * `fetchArtistTracks` avale l'erreur d'annulation et résout avec une liste
 * vide : branchée telle quelle sur un `setState`, la réponse annulée de
 * l'artiste précédent efface les titres de l'artiste suivant (elle arrive
 * après lui quand celui-ci est déjà en cache). Ce garde-fou est le même sur
 * les quatre écrans qui listent des titres — il vit donc ici, pas dans les apps.
 */
export function loadArtistTracks(
  artistName: string,
  onTracks: (tracks: StreamedTrack[]) => void,
  limit = DEFAULT_TRACK_LIMIT,
): () => void {
  const controller = new AbortController()
  void fetchArtistTracks(artistName, controller.signal, limit)
    .then((tracks) => {
      if (controller.signal.aborted) return
      onTracks(tracks)
    })
    .catch(() => {
      if (controller.signal.aborted) return
      onTracks([])
    })
  return () => controller.abort()
}

// Deezer a servi de source de titres complémentaire jusqu'ici. Retiré :
// `api.deezer.com` n'envoie aucun en-tête CORS, l'appel était donc toujours
// bloqué dans un navigateur et ne fonctionnait que sur mobile — deux surfaces,
// deux listes de titres pour le même artiste. Apple Music est la source
// unique, identique partout. Le lien vers le profil Deezer d'un artiste
// (`platforms.deezer`) n'est pas concerné : c'est un simple lien sortant.
// L'ingestion (`scripts/populate-map.mjs`) interroge toujours Deezer côté
// serveur, où CORS ne s'applique pas.
