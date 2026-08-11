import { supabase, hasSupabase } from './supabase'

/**
 * Vues artistes — même RPC que le web (00040) : chaque vue est journalisée
 * avec la clé d'appareil anonyme du mobile pour les vues uniques par user.
 */

export interface StreakInfo {
  current: number
  best: number
  total: number
  checkedToday: boolean
}

/**
 * Score de popularité de TOUS les artistes en une requête (lecture publique
 * de `artist_stats`) : id → profile_views + pin_views. Sert aux anneaux de
 * couleur des pins de la carte (tier 0-3) sans N+1.
 */
export async function fetchAllArtistPopularity(): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!hasSupabase) return out
  try {
    const { data, error } = await supabase!
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
    // lecture optionnelle : la carte reste fonctionnelle sans popularité
  }
  return out
}

/** Pointage quotidien (streak) — même RPC que le web (00041), idempotent par jour. */
export async function checkin(): Promise<StreakInfo | null> {
  if (!hasSupabase) return null
  try {
    const { data, error } = await supabase!.rpc('checkin')
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

/** Notifie l'artiste revendiqué (follow / booking) — même RPC que le web. */
export async function notifyArtistAction(
  artistId: string,
  type: 'follow' | 'like' | 'booking' | 'achievement',
  message: string,
): Promise<void> {
  if (!hasSupabase || !artistId) return
  try {
    await supabase!.rpc('notify_artist_action', {
      p_artist_id: artistId,
      p_type: type,
      p_message: message,
    })
  } catch {
    /* silencieux */
  }
}

export async function recordProfileView(
  artistId: string,
  opts?: { viewerKey?: string; country?: string | null },
): Promise<void> {
  if (!hasSupabase || !artistId) return
  try {
    await supabase!.rpc('record_artist_view', {
      p_artist_id: artistId,
      p_kind: 'profile',
      p_viewer_key: opts?.viewerKey ?? null,
      p_country: opts?.country ?? null,
    })
  } catch {
    /* silencieux : les stats ne bloquent jamais l'UI */
  }
}

export async function recordPinView(
  artistId: string,
  opts?: { viewerKey?: string; country?: string | null },
): Promise<void> {
  if (!hasSupabase || !artistId) return
  try {
    await supabase!.rpc('record_artist_view', {
      p_artist_id: artistId,
      p_kind: 'pin',
      p_viewer_key: opts?.viewerKey ?? null,
      p_country: opts?.country ?? null,
    })
  } catch {
    /* silencieux */
  }
}

/**
 * Abonnements aux artistes — la table follows est partagée avec le web
 * (migration 00029) : suivre un artiste sur mobile alimente le même
 * compteur d'abonnés que sur musimaps.app.
 */

/** Artistes suivis par l'utilisateur connecté. */
export async function fetchFollowing(): Promise<string[]> {
  if (!hasSupabase) return []
  const { data, error } = await supabase!.from('follows').select('artist_id')
  if (error) return []
  return (data ?? []).map((row) => row.artist_id)
}

/** Bascule un abonnement (suivre). Retourne true si maintenant suivi.
 *  `notifyMessage` (optionnel) est envoyé à l'artiste revendiqué. */
export async function toggleFollow(
  artistId: string,
  notifyMessage?: string,
): Promise<{
  ok: boolean
  following: boolean
  error?: string
}> {
  if (!hasSupabase) return { ok: false, following: false, error: 'Supabase non configuré' }
  const current = await fetchFollowing()
  const following = current.includes(artistId)
  if (following) {
    const { error } = await supabase!.from('follows').delete().eq('artist_id', artistId)
    return error ? { ok: false, following: true, error: error.message } : { ok: true, following: false }
  }
  const { error } = await supabase!.from('follows').insert({ artist_id: artistId })
  if (!error) {
    void notifyArtistAction(artistId, 'follow', notifyMessage ?? '')
  }
  return error ? { ok: false, following: false, error: error.message } : { ok: true, following: true }
}

/** Nombre d'abonnés d'un artiste sur Musimaps (lecture publique). */
export async function fetchArtistFollowers(artistId: string): Promise<number> {
  if (!hasSupabase || !artistId) return 0
  const { data, error } = await supabase!.rpc('count_artist_followers', {
    p_artist_id: artistId,
  })
  if (error) return 0
  return typeof data === 'number' ? data : 0
}

/** Nombre de likes (favoris) d'un artiste sur Musimaps (lecture publique). */
export async function fetchArtistLikes(artistId: string): Promise<number> {
  if (!hasSupabase || !artistId) return 0
  const { data, error } = await supabase!.rpc('count_artist_likes', {
    p_artist_id: artistId,
  })
  if (error) return 0
  return typeof data === 'number' ? data : 0
}

/** -------------------------------------------------------------
 * Analytique détaillée d'un artiste — mêmes RPC que le web.
 * ------------------------------------------------------------- */

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

/** L'identifiant de l'artiste correspondant au nom (profil de l'artiste connecté). */
export async function fetchArtistIdByName(name: string): Promise<string | null> {
  if (!hasSupabase || !name.trim()) return null
  const { data, error } = await supabase!
    .from('map_artists')
    .select('id')
    .ilike('name', name.trim())
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data.id as string
}

/** Stats détaillées (réservé à l'artiste propriétaire du profil ou à un admin). */
export async function fetchArtistStatsDetail(artistId: string): Promise<ArtistStatsDetail | null> {
  if (!hasSupabase || !artistId) return null
  const { data, error } = await supabase!.rpc('artist_stats_detail', { p_artist_id: artistId })
  if (error || !data) return null
  return data as unknown as ArtistStatsDetail
}
