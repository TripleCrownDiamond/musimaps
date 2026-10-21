/**
 * Modération des fiches d'artiste — signaler et bloquer.
 *
 * Les fiches sont en partie écrites par les artistes eux-mêmes (bio, photo,
 * liens) : c'est du contenu généré par les utilisateurs. Tout utilisateur
 * connecté peut donc signaler une fiche à l'équipe et masquer un artiste de
 * sa carte. Même logique sur web et mobile ; chaque app ne fait que l'écran.
 *
 * Tables : `content_reports` et `artist_blocks` (migration 00077).
 */
import { getSupabase } from '../runtime'

/** Motifs de signalement, dans l'ordre d'affichage. Libellés : `report.reason.*`. */
export const REPORT_REASONS = ['inappropriate', 'impersonation', 'copyright', 'spam', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

/** Longueur maximale du commentaire libre (même borne que la contrainte SQL). */
export const REPORT_DETAILS_MAX = 1000

export async function reportArtist(
  artistId: string,
  reason: ReportReason,
  details = '',
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Supabase non configuré' }
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { ok: false, error: 'auth' }
  const { error } = await supabase.from('content_reports').insert({
    reporter_id: data.user.id,
    artist_id: artistId,
    reason,
    details: details.trim().slice(0, REPORT_DETAILS_MAX),
  })
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Artistes que l'utilisateur connecté a bloqués (vide hors connexion). */
export async function fetchBlockedArtists(): Promise<string[]> {
  const supabase = getSupabase()
  if (!supabase) return []
  try {
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) return []
    const { data, error } = await supabase.from('artist_blocks').select('artist_id')
    if (error || !data) return []
    return data.map((row: { artist_id: string }) => row.artist_id)
  } catch {
    return []
  }
}

/** Écrans à prévenir d'un blocage : l'artiste disparaît tout de suite de la carte. */
const blockListeners = new Set<(artistId: string) => void>()

export function onArtistBlocked(listener: (artistId: string) => void): () => void {
  blockListeners.add(listener)
  return () => {
    blockListeners.delete(listener)
  }
}

export async function blockArtist(artistId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Supabase non configuré' }
  const { data } = await supabase.auth.getUser()
  if (!data.user) return { ok: false, error: 'auth' }
  const { error } = await supabase
    .from('artist_blocks')
    .upsert({ user_id: data.user.id, artist_id: artistId }, { onConflict: 'user_id,artist_id', ignoreDuplicates: true })
  if (error) return { ok: false, error: error.message }
  blockListeners.forEach((listener) => listener(artistId))
  return { ok: true }
}

export async function unblockArtist(artistId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Supabase non configuré' }
  const { error } = await supabase.from('artist_blocks').delete().eq('artist_id', artistId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Retire les artistes bloqués d'une liste (pur, testable). */
export function withoutBlocked<T extends { id: string }>(artists: T[], blocked: Iterable<string>): T[] {
  const ids = new Set(blocked)
  return ids.size === 0 ? artists : artists.filter((artist) => !ids.has(artist.id))
}
