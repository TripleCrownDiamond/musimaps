/**
 * Statistiques, favoris, suivis et streak — partagé web + mobile.
 *
 * Base : la version web (surface la plus complète, 19 fonctions contre 11).
 * Reprend du mobile le `fetchArtistIdByName` qui lui était propre et les
 * try/catch dont le web manquait : `checkin` et `fetchAllArtistPopularity`
 * laissaient remonter une erreur réseau côté web.
 *
 * ⚠️ Les favoris passent par la table Supabase `favorites` (liée au compte).
 * Le mobile utilise encore un stockage LOCAL (AsyncStorage) et ne consomme
 * donc pas `toggleFavorite`/`fetchFavorites` : les favoris ne se
 * synchronisent pas entre les deux plateformes. Voir docs/PLAN-COHERENCE-WEB-MOBILE.md.
 */
import { getStorage, getSupabase } from '../runtime'

/** Clé d'appareil anonyme et stable (stockage injecté) pour les vues non connectées. */
const VIEWER_KEY_STORAGE = 'musimaps.viewer-key'

export async function getViewerKey(): Promise<string> {
  try {
    const storage = getStorage()
    let key = await storage.get(VIEWER_KEY_STORAGE)
    if (!key) {
      key = `mm-${globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)}`
      await storage.set(VIEWER_KEY_STORAGE, key)
    }
    return key
  } catch {
    return `mm-${Math.random().toString(36).slice(2)}`
  }
}

/** Pays du visiteur connecté (dernière partie de la ville, ex. « Cotonou, Benin » → « Benin »). */
export function viewerCountryFromCity(city: string | null | undefined): string | null {
  if (!city) return null
  const parts = city.split(',').map((s) => s.trim()).filter(Boolean)
  const country = parts[parts.length - 1]
  return country && country.length >= 2 ? country : null
}

export interface ArtistSummary {
  id: string
  name: string
  genre: string
  city: string
  country: string
  flag: string
  image?: string
  verified?: boolean
}

export interface ArtistStats {
  artistId: string
  profileViews: number
  pinViews: number
}

/** Stats analytiques détaillées d'un artiste (RPC artist_stats_detail, artiste/admin). */
export interface ArtistStatsDetail {
  artist_id: string
  total: number
  profile_views: number
  pin_views: number
  likes: number
  likes_by_day: { day: string; likes: number }[]
  unique_viewers: number
  viewers_connected: number
  top_countries: { country: string; views: number; unique_viewers: number }[]
  by_day: { day: string; views: number }[]
  top_viewers: { label: string; views: number; kind: string[] }[]
}

/** Stats détaillées (réservé à l'artiste propriétaire du profil ou à un admin). */
export async function fetchArtistStatsDetail(artistId: string): Promise<ArtistStatsDetail | null> {
  const supabase = getSupabase()

  if (!supabase || !artistId) return null
  const { data, error } = await supabase.rpc('artist_stats_detail', { p_artist_id: artistId })
  if (error || !data) return null
  return data as unknown as ArtistStatsDetail
}

/** Remet les compteurs de vues à zéro (réservé aux admins). */
export async function resetArtistStats(): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase()

  if (!supabase) return { ok: false, error: 'Supabase non configuré' }
  const { data, error } = await supabase.rpc('reset_artist_stats')
  if (error) return { ok: false, error: error.message }
  return (data as { ok?: boolean } | null)?.ok
    ? { ok: true }
    : { ok: false, error: 'Réinitialisation impossible' }
}

/**
 * Nombre d'abonnés réels de l'artiste sur Musimaps (follows).
 * Lecture publique via la fonction count_artist_followers.
 */
export async function fetchArtistFollowers(artistId: string): Promise<number> {
  const supabase = getSupabase()

  if (!supabase || !artistId) return 0
  const { data, error } = await supabase.rpc('count_artist_followers', {
    p_artist_id: artistId,
  })
  if (error) return 0
  return typeof data === 'number' ? data : 0
}

/** Nombre de likes (favoris) d'un artiste sur Musimaps.
 * Lecture publique via la fonction count_artist_likes. */
export async function fetchArtistLikes(artistId: string): Promise<number> {
  const supabase = getSupabase()

  if (!supabase || !artistId) return 0
  const { data, error } = await supabase.rpc('count_artist_likes', {
    p_artist_id: artistId,
  })
  if (error) return 0
  return typeof data === 'number' ? data : 0
}

/**
 * Score de popularité de TOUS les artistes en une requête (lecture publique
 * de `artist_stats`) : id → profile_views + pin_views. Sert aux anneaux de
 * couleur des pins de la carte (tier 0-3) sans N+1.
 */
export async function fetchAllArtistPopularity(): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  const supabase = getSupabase()

  if (!supabase) return out
  // try/catch repris du mobile : lecture optionnelle, la carte reste
  // fonctionnelle sans les scores de popularité.
  try {
    const { data, error } = await supabase
      .from('artist_stats')
      .select('artist_id, profile_views, pin_views')
    if (error || !data) return out
    for (const row of data as Array<{
      artist_id: string
      profile_views?: number
      pin_views?: number
    }>) {
      out.set(row.artist_id, (row.profile_views ?? 0) + (row.pin_views ?? 0))
    }
  } catch {
    /* silencieux */
  }
  return out
}

/** Compteurs de vues d'un artiste (lecture publique). */
export async function fetchArtistStats(artistId: string): Promise<ArtistStats | null> {
  const supabase = getSupabase()

  if (!supabase) return null
  const { data, error } = await supabase
    .from('artist_stats')
    .select('artist_id, profile_views, pin_views')
    .eq('artist_id', artistId)
    .maybeSingle()
  if (error || !data) return null
  return {
    artistId: data.artist_id,
    profileViews: data.profile_views ?? 0,
    pinViews: data.pin_views ?? 0,
  }
}

/** Compteurs d'un artiste identifié par son nom (le profil de l'artiste connecté).
 *  Deux requêtes séquentielles (pas d'embedding : évite de dépendre d'une FK). */
export async function fetchArtistStatsByName(
  name: string,
): Promise<{ artistId: string; profileViews: number; pinViews: number } | null> {
  const supabase = getSupabase()
  if (!supabase || !name.trim()) return null
  const { data, error } = await supabase
    .from('map_artists')
    .select('id')
    .ilike('name', name.trim())
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  const stats = await fetchArtistStats(data.id)
  if (!stats) return { artistId: data.id, profileViews: 0, pinViews: 0 }
  return { artistId: data.id, profileViews: stats.profileViews, pinViews: stats.pinViews }
}

/** -------------------------------------------------------------
 * Streak de connexion — pointage quotidien (RPC checkin, idempotent
 * dans la journée : n'incrémente qu'une fois par jour).
 * ------------------------------------------------------------- */
export interface StreakInfo {
  current: number
  best: number
  total: number
  checkedToday: boolean
}

/** Pointage quotidien : appelé à chaque connexion / ouverture du dashboard. */
export async function checkin(): Promise<StreakInfo | null> {
  const supabase = getSupabase()

  if (!supabase) return null
  // try/catch repris du mobile : le web laissait remonter une erreur réseau.
  try {
    const { data, error } = await supabase.rpc('checkin')
    if (error || !data) return null
    const raw = data as { ok?: boolean; current?: number; best?: number; total?: number; checked_today?: boolean }
    if (!raw.ok) return null
    return {
      current: raw.current ?? 0,
      best: raw.best ?? 0,
      total: raw.total ?? 0,
      checkedToday: raw.checked_today ?? false,
    }
  } catch {
    return null
  }
}

/** Notifie l'artiste revendiqué (follow / like / booking / achievement).
 *  Fire-and-forget : l'échec ne doit jamais casser l'action principale. */
export async function notifyArtistAction(
  artistId: string,
  type: 'follow' | 'like' | 'booking' | 'achievement',
  message: string,
): Promise<void> {
  const supabase = getSupabase()

  if (!supabase || !artistId) return
  try {
    await supabase.rpc('notify_artist_action', {
      p_artist_id: artistId,
      p_type: type,
      p_message: message,
    })
  } catch {
    /* silencieux */
  }
}

/** L'artiste notifie le demandeur d'un booking (confirmé / rejeté). */
export async function notifyBookingStatus(
  bookingId: string,
  status: string,
  message: string,
): Promise<void> {
  const supabase = getSupabase()

  if (!supabase || !bookingId) return
  try {
    await supabase.rpc('notify_booking_status', {
      p_booking_id: bookingId,
      p_status: status,
      p_message: message,
    })
  } catch {
    /* silencieux */
  }
}

/** Compte une vue de profil artiste (fire-and-forget). Inclut la clé d'appareil
 *  et le pays du visiteur pour l'analytique unique (vues par user / par pays). */
export async function recordProfileView(
  artistId: string,
  opts?: { viewerKey?: string; country?: string | null },
): Promise<void> {
  const supabase = getSupabase()

  if (!supabase || !artistId) return
  try {
    await supabase.rpc('record_artist_view', {
      p_artist_id: artistId,
      p_kind: 'profile',
      p_viewer_key: opts?.viewerKey ?? (await getViewerKey()),
      p_country: opts?.country ?? null,
    })
  } catch {
    /* silencieux : les stats ne bloquent jamais l'UI */
  }
}

/** Compte une vue de pin sur la carte (fire-and-forget). */
export async function recordPinView(
  artistId: string,
  opts?: { viewerKey?: string; country?: string | null },
): Promise<void> {
  const supabase = getSupabase()

  if (!supabase || !artistId) return
  try {
    await supabase.rpc('record_artist_view', {
      p_artist_id: artistId,
      p_kind: 'pin',
      p_viewer_key: opts?.viewerKey ?? (await getViewerKey()),
      p_country: opts?.country ?? null,
    })
  } catch {
    /* silencieux */
  }
}

/** Artistes favoris de l'utilisateur connecté. */
export async function fetchFavorites(): Promise<string[]> {
  const supabase = getSupabase()

  if (!supabase) return []
  const { data, error } = await supabase.from('favorites').select('artist_id')
  if (error) return []
  return (data ?? []).map((row) => row.artist_id)
}

/** Détails des artistes de la carte pour une liste d'ids (favoris, suivis…). */
export async function fetchArtistsByIds(ids: string[]): Promise<ArtistSummary[]> {
  const supabase = getSupabase()

  if (!supabase || ids.length === 0) return []
  const { data, error } = await supabase
    .from('map_artists')
    .select('id, name, genre, city, country, flag, image, verified')
    .in('id', ids)
  if (error || !data) return []
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    genre: row.genre ?? '',
    city: row.city ?? '',
    country: row.country ?? '',
    flag: row.flag ?? '🌍',
    image: row.image ?? undefined,
    verified: row.verified ?? false,
  }))
}

/** Bascule un artiste en favori (like). Retourne true si maintenant en favori. */
export async function toggleFavorite(artistId: string): Promise<{ ok: boolean; liked: boolean; error?: string }> {
  const supabase = getSupabase()

  if (!supabase) return { ok: false, liked: false, error: 'Supabase non configuré' }
  const current = await fetchFavorites()
  const liked = current.includes(artistId)
  if (liked) {
    const { error } = await supabase.from('favorites').delete().eq('artist_id', artistId)
    return error ? { ok: false, liked: true, error: error.message } : { ok: true, liked: false }
  }
  const { error } = await supabase.from('favorites').insert({ artist_id: artistId })
  return error ? { ok: false, liked: false, error: error.message } : { ok: true, liked: true }
}

/** -------------------------------------------------------------
 * Suivre un artiste (abonnement) — distinct du like/favori.
 * La table follows a besoin de la migration 00029 : si elle n'est
 * pas encore en base, on retombe gracieusement sur les favoris.
 * ------------------------------------------------------------- */

/** Artistes suivis par l'utilisateur connecté. */
export async function fetchFollowing(): Promise<string[]> {
  const supabase = getSupabase()

  if (!supabase) return []
  const { data, error } = await supabase.from('follows').select('artist_id')
  if (error) return []
  return (data ?? []).map((row) => row.artist_id)
}

/** Bascule un abonnement (suivre). Retourne true si maintenant suivi.
 *  `notifyMessage` (optionnel, localisé par l'appelant) est envoyé à
 *  l'artiste revendiqué quand on commence à suivre. */
export async function toggleFollow(
  artistId: string,
  notifyMessage?: string,
): Promise<{ ok: boolean; following: boolean; error?: string }> {
  const supabase = getSupabase()

  if (!supabase) return { ok: false, following: false, error: 'Supabase non configuré' }
  const current = await fetchFollowing()
  const following = current.includes(artistId)
  if (following) {
    const { error } = await supabase.from('follows').delete().eq('artist_id', artistId)
    return error ? { ok: false, following: true, error: error.message } : { ok: true, following: false }
  }
  const { error } = await supabase.from('follows').insert({ artist_id: artistId })
  if (!error) {
    // Notifie l'artiste revendiqué (message localisé de l'appelant).
    void notifyArtistAction(artistId, 'follow', notifyMessage ?? '')
  }
  return error ? { ok: false, following: false, error: error.message } : { ok: true, following: true }
}

/**
 * Identifiant d'un artiste de la carte à partir de son nom (insensible à la
 * casse). Était propre au mobile ; disponible aux deux plateformes.
 */
export async function fetchArtistIdByName(name: string): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase || !name.trim()) return null
  const { data, error } = await supabase
    .from('map_artists')
    .select('id')
    .ilike('name', name.trim())
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data.id as string
}
