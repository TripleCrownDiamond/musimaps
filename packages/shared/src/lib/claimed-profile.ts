/**
 * Profil revendiqué de l'artiste connecté — la carte qu'il possède
 * (claimed_by). Permet de gérer photo, cover, bio et liens depuis le
 * compte (migration 00031). Partagé web + mobile.
 */
import { getSupabase } from '../runtime';

export interface ClaimedArtistProfile {
  id: string;
  name: string;
  genre: string;
  city: string;
  country: string;
  flag: string;
  lat: number;
  lng: number;
  bio: string;
  image: string;
  cover: string;
  source: string;
  platforms: Record<string, string>;
  socials: Record<string, string>;
  verified: boolean;
  slug?: string | null;
}

/** Le profil de la carte revendiqué par l'utilisateur connecté (ou null). */
export async function fetchMyArtistProfile(): Promise<ClaimedArtistProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_claimed_profile');
  if (error) return null;
  return data as ClaimedArtistProfile | null;
}

/** Met à jour son profil revendiqué (photo, cover, bio, genre, liens). */
export async function updateMyArtistProfile(input: {
  image?: string;
  cover?: string;
  bio?: string;
  genre?: string;
  platforms?: Record<string, string>;
  socials?: Record<string, string>;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase non configuré' };
  const { data, error } = await supabase.rpc('update_claimed_profile', {
    p_image: input.image ?? null,
    p_cover: input.cover ?? null,
    p_bio: input.bio ?? null,
    p_genre: input.genre ?? null,
    p_platforms: input.platforms ?? null,
    p_socials: input.socials ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? 'Erreur inconnue' };
}

/**
 * Upload une image (photo ou cover) dans le bucket artist-images et renvoie
 * son URL publique. Accepte un fichier web (File) ou un URI local (mobile)
 * via `uploadFile`.
 */
export async function uploadArtistImage(
  file: File | { uri: string; name: string; type: string },
  folder: 'artists' | 'covers',
): Promise<{ url: string; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { url: '', error: 'Supabase non configuré' };

  const ext = (file instanceof File ? file.name : file.name).split('.').pop() ?? 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const contentType = file instanceof File ? file.type : file.type;

  let uploadData: Blob | ArrayBuffer;
  if (file instanceof File) {
    uploadData = file;
  } else {
    // React Native : fetch the local URI to get a Blob.
    const response = await fetch(file.uri);
    uploadData = await response.blob();
  }

  const { error } = await supabase.storage
    .from('artist-images')
    .upload(path, uploadData, { contentType, upsert: false });

  if (error) return { url: '', error: error.message };

  const { data: urlData } = supabase.storage.from('artist-images').getPublicUrl(path);
  return { url: urlData.publicUrl };
}

/** Réservations — forfaits de l'artiste revendiqué (migration 00048). */
export async function updateArtistBooking(
  artistId: string,
  bookable: boolean,
  plans: Array<{
    name: string;
    description?: string | null;
    price: number;
    currency?: string;
    duration?: string | null;
    active: boolean;
  }>,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase non configuré' };
  const { data, error } = await supabase.rpc('update_artist_booking', {
    p_artist_id: artistId,
    p_bookable: bookable,
    p_plans: plans,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? 'Erreur inconnue' };
}
