/**
 * Récupération automatique des titres d'un artiste depuis l'iTunes Search
 * API (Apple Music) — publique, sans clé. La durée et le preview audio
 * (30 s) permettent de peupler l'onglet « Musiques » sans intervention.
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

/** Normalise un nom pour comparaison approximative (minuscules, sans accents). */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Homonymes désambiguïsés qu'iTunes renvoie (tribute, cover, toon…). */
const AMBIGUOUS_ARTIST = /\((tribute|cover|toon|karaoke|remix|live|band|trio|duo|project|official|original|club|dj)\)/i

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
  return normalize(trackArtist)
    .split(/\s+(?:feat\.?|ft\.?|duet with|featuring|with|and|avec|vs\.?|x)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean)
}

/**
 * Les résultats iTunes peuvent contenir des homonymes (« Booba (toon) »),
 * des reprises ou des artistes crédités différemment. On accepte un titre si
 * l'artiste cherché apparaît parmi les participants (collab) ou si le crédit
 * est un collectif/alias connu de cet artiste.
 */
function matchesArtist(trackArtist: string, artistName: string): boolean {
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
  return false
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
  limit = 24,
): Promise<StreamedTrack[]> {
  const name = artistName.trim()
  if (!name) return []
  const cached = trackCache.get(name)
  if (cached) return cached.slice(0, limit)
  try {
    const url =
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}` +
      `&entity=song&media=music&limit=50`
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
    // Deezer : API publique sans clé, en complément d'iTunes.
    const deezerTracks = await fetchDeezerTracks(name, signal, limit)
    for (const dt of deezerTracks) {
      const key = normalize(dt.title)
      if (seen.has(key)) continue
      seen.add(key)
      tracks.push(dt)
      if (tracks.length >= limit) break
    }
    if (tracks.length > 0) {
      trackCache.set(name, tracks)
      // Fraîcheur : la liste reste en cache 1 heure, puis sera re-moissonnée.
      setTimeout(() => trackCache.delete(name), 60 * 60 * 1000)
    }
    return tracks
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────────
// Deezer — API publique (sans clé), limitée à ~50 req/min.
// ─────────────────────────────────────────────────────────────────────

interface DeezerTrack {
  title: string
  artist: { name: string }
  album: { title: string; cover_medium?: string }
  duration: number
  preview: string
  link: string
}

async function fetchDeezerTracks(
  artistName: string,
  signal?: AbortSignal,
  limit = 24,
): Promise<StreamedTrack[]> {
  try {
    // 1) Trouver l'artiste par nom (top résultat).
    const searchRes = await fetch(
      `https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}`,
      { signal },
    )
    if (!searchRes.ok) return []
    const searchData = (await searchRes.json()) as { data?: Array<{ id: number; name: string }> }
    const match = searchData.data?.find((a) => matchesArtist(a.name, artistName))
    if (!match) return []
    // 2) Récupérer les top titres de cet artiste.
    const topRes = await fetch(
      `https://api.deezer.com/artist/${match.id}/top?limit=${limit}`,
      { signal },
    )
    if (!topRes.ok) return []
    const topData = (await topRes.json()) as { data?: DeezerTrack[] }
    const tracks: StreamedTrack[] = []
    for (const r of topData.data ?? []) {
      if (!r.title) continue
      const artwork = r.album?.cover_medium ?? ''
      tracks.push({
        title: r.title,
        album: r.album?.title ?? '',
        duration: formatDuration(r.duration * 1000),
        artwork,
        url: r.link || `https://www.deezer.com/artist/${match.id}`,
        previewUrl: r.preview,
      })
    }
    return tracks
  } catch {
    return []
  }
}
