/**
 * Profil revendiqué de l'artiste connecté — la carte qu'il possède
 * (claimed_by). Permet de gérer photo, bio et liens depuis le
 * compte (migration 00031). Partagé web + mobile.
 */
import { getSupabase } from '../runtime';

export interface ClaimedArtistProfile {
  id: string;
  name: string;
  genre: string;
  city: string;
  district?: string | null;
  country: string;
  flag: string;
  lat: number;
  lng: number;
  bio: string;
  image: string;
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

/**
 * Vérifie qu'une adresse publique artiste est encore libre. La base reste la
 * source de vérité : une vérification uniquement côté écran laisserait deux
 * artistes choisir le même lien en parallèle.
 */
export async function checkArtistSlugAvailability(
  slug: string,
  excludeArtistId?: string,
): Promise<{ available: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { available: false, error: 'Supabase non configuré' };
  const { data, error } = await supabase.rpc('check_slug_unique', {
    p_slug: slug,
    p_exclude_id: excludeArtistId ?? null,
  });
  if (error) return { available: false, error: error.message };
  return { available: data === true };
}

/** Met à jour son profil revendiqué (photo, bio, genre, liens). */
export async function updateMyArtistProfile(input: {
  image?: string;
  bio?: string;
  genre?: string;
  platforms?: Record<string, string>;
  socials?: Record<string, string>;
  city?: string;
  district?: string;
  slug?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase non configuré' };
  const { data, error } = await supabase.rpc('update_claimed_profile', {
    p_image: input.image ?? null,
    p_bio: input.bio ?? null,
    p_genre: input.genre ?? null,
    p_platforms: input.platforms ?? null,
    p_socials: input.socials ?? null,
    p_city: input.city ?? null,
    p_district: input.district ?? null,
    p_slug: input.slug ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? 'Erreur inconnue' };
}

/**
 * Upload une image (photo de profil) dans le bucket artist-images et renvoie
 * son URL publique. Accepte un fichier web (File) ou un URI local (mobile)
 * via `uploadFile`.
 */
export async function uploadArtistImage(
  file: File | { uri: string; name: string; type: string },
): Promise<{ url: string; error?: string }> {
  return uploadImageToBucket(file, 'artists');
}

/** Upload d'un visuel du profil de compte (avatar). */
export async function uploadProfileImage(
  file: File | { uri: string; name: string; type: string },
): Promise<{ url: string; error?: string }> {
  return uploadImageToBucket(file, 'profiles');
}

type UploadImageFile = File | { uri: string; name: string; type: string };

function isWebUploadFile(file: UploadImageFile): file is File {
  return typeof File !== 'undefined' && file instanceof File;
}

async function uploadImageToBucket(
  file: UploadImageFile,
  folder: 'artists' | 'profiles',
): Promise<{ url: string; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { url: '', error: 'Supabase non configuré' };

  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const contentType = file.type || 'image/jpeg';

  let uploadData: Blob | ArrayBuffer;
  if (isWebUploadFile(file)) {
    uploadData = file;
  } else {
    // React Native : surtout pas de Blob. storage-js emballe un Blob dans un
    // FormData, que React Native ne sait pas sérialiser : la partie part en
    // `text/plain` et le bucket la refuse (« mime type text/plain is not
    // supported »). Un ArrayBuffer est envoyé brut avec son content-type.
    const response = await fetch(file.uri);
    uploadData = await response.arrayBuffer();
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
