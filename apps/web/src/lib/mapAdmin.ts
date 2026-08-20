/**
 * Corrections de localisation par un administrateur, depuis la carte.
 *
 * Aucune migration n'a été nécessaire : la politique `map_artists_update_admin`
 * (migration 00016) autorise déjà `public.is_admin()` à corriger les données.
 * Ce module se contente d'écrire les champs que l'admin peut toucher — et
 * seulement ceux-là.
 */
import { slugify } from '@musimaps/shared'
import { supabase, hasSupabase } from './supabase'

/**
 * Champs modifiables depuis la carte.
 *
 * Volontairement limité à la LOCALISATION et à l'identité minimale. Le reste
 * de la fiche (bio, plateformes, réseaux, vérification) se gère dans l'admin,
 * qui a l'écran pour ça — dupliquer ces champs ici créerait deux formulaires
 * pour une même donnée, donc deux façons de la faire diverger.
 */
export interface MapArtistPatch {
  name?: string
  genre?: string
  district?: string | null
  city?: string
  country?: string
  flag?: string
  slug?: string | null
  coordinates?: [number, number]
}

export interface MapArtistSaveResult {
  ok: boolean
  error?: string
}

/**
 * Écrit la correction. Renvoie un résultat plutôt que de lever : l'appelant
 * est une carte, pas un script — une erreur doit s'afficher dans le panneau,
 * pas casser le rendu.
 */
export async function saveMapArtist(
  id: string,
  patch: MapArtistPatch,
): Promise<MapArtistSaveResult> {
  if (!hasSupabase()) return { ok: false, error: 'supabase' }

  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name.trim()
  if (patch.genre !== undefined) row.genre = patch.genre.trim()
  if (patch.city !== undefined) row.city = patch.city.trim()
  if (patch.country !== undefined) row.country = patch.country.trim()
  if (patch.flag !== undefined) row.flag = patch.flag.trim()
  // `district` accepte le vide : c'est ainsi qu'on efface un quartier erroné.
  // `NULLIF` côté base ne s'applique qu'au RPC de référencement, pas ici.
  if (patch.district !== undefined) {
    const value = (patch.district ?? '').trim()
    row.district = value === '' ? null : value
  }
  if (patch.slug !== undefined) {
    const raw = patch.slug === null ? null : patch.slug.trim()
    const slug = raw === '' || raw === null ? null : slugify(raw)
    // Vérifie l'unicité du slug en base (excluant l'artiste en cours).
    if (slug) {
      const { data: taken } = await supabase!.rpc('check_slug_unique', {
        p_slug: slug,
        p_exclude_id: id,
      })
      if (taken === false) {
        return { ok: false, error: 'slug_taken' }
      }
    }
    row.slug = slug
  }
  if (patch.coordinates) {
    row.lng = patch.coordinates[0]
    row.lat = patch.coordinates[1]
  }

  if (Object.keys(row).length === 0) return { ok: true }

  const { error } = await supabase!.from('map_artists').update(row).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}
