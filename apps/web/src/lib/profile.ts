import { supabase, hasSupabase } from './supabase'
import { uploadArtistPhoto } from './waitlist'

/**
 * Profil revendiqué de l'artiste connecté — le profil de la carte qu'il
 * possède (claimed_by). Permet de gérer photo, cover, bio et liens depuis
 * le compte (migration 00031).
 */

export interface ClaimedArtistProfile {
  id: string
  name: string
  genre: string
  city: string
  country: string
  flag: string
  lat: number
  lng: number
  bio: string
  image: string
  cover: string
  source: string
  platforms: Record<string, string>
  socials: Record<string, string>
  verified: boolean
}

/** Le profil de la carte revendiqué par l'utilisateur connecté (ou null). */
export async function fetchMyArtistProfile(): Promise<ClaimedArtistProfile | null> {
  if (!hasSupabase()) return null
  const { data, error } = await supabase!.rpc('get_claimed_profile')
  if (error) return null
  return data as ClaimedArtistProfile | null
}

/** Met à jour son profil revendiqué (photo, cover, bio, genre, liens). */
export async function updateMyArtistProfile(input: {
  image?: string
  cover?: string
  bio?: string
  genre?: string
  platforms?: Record<string, string>
  socials?: Record<string, string>
}): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }
  const { data, error } = await supabase!.rpc('update_claimed_profile', {
    p_image: input.image ?? null,
    p_cover: input.cover ?? null,
    p_bio: input.bio ?? null,
    p_genre: input.genre ?? null,
    p_platforms: input.platforms ?? null,
    p_socials: input.socials ?? null,
  })
  if (error) return { ok: false, error: error.message }
  const result = data as { ok?: boolean; error?: string } | null
  return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? 'Erreur inconnue' }
}

/**
 * Upload une image (photo ou cover) dans le bucket artist-images et renvoie
 * son URL publique. Réutilise uploadArtistPhoto (waitlist) avec un folder.
 */
export async function uploadArtistImage(
  file: File,
  folder: 'artists' | 'covers',
): Promise<{ url: string; error?: string }> {
  return uploadArtistPhoto(file, folder)
}

/**
 * Réservations — forfaits (migration 00048) : l'artiste revendiqué gère sa
 * bascule « réservable » et son catalogue de prestations (tarifs à venir).
 */

export interface BookingPlan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  duration: string
  active: boolean
}

export interface ArtistBooking {
  bookable: boolean
  plans: BookingPlan[]
}

/** Forfaits + état réservable du profil revendiqué (ou du profil choisi). */
export async function fetchArtistBooking(
  artistId?: string,
): Promise<ArtistBooking | null> {
  if (!hasSupabase()) return null
  const { data, error } = await supabase!.rpc('get_artist_booking', {
    p_artist_id: artistId ?? '',
  })
  if (error || !data) return null
  const booking = data as ArtistBooking | null
  return booking && Array.isArray(booking.plans) ? booking : null
}

/** Met à jour réservable + forfaits (artiste revendiqué ou admin). */
export async function updateArtistBooking(
  artistId: string,
  bookable: boolean,
  plans: Array<{
    name: string
    description?: string
    price: number
    currency?: string
    duration?: string
    active: boolean
  }>,
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }
  const { data, error } = await supabase!.rpc('update_artist_booking', {
    p_artist_id: artistId,
    p_bookable: bookable,
    p_plans: plans,
  })
  if (error) return { ok: false, error: error.message }
  const result = data as { ok?: boolean; error?: string } | null
  return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? 'Erreur inconnue' }
}
