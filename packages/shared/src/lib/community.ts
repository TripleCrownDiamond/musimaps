/**
 * Communauté de mélomanes — partagé web + mobile.
 *
 * Profil public au choix, suivre un mélomane, sélections d'artistes
 * partageables. Les données publiques ne viennent que des RPC de la
 * migration 00080, qui ne renvoient que des colonnes sûres : la table
 * `profiles` reste fermée en lecture.
 */
import { getSupabase } from '../runtime';

/** Identifiant public (`@awa.cotonou`) : bornes de la contrainte SQL `profiles_handle_format`. */
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;
const HANDLE_RE = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/;

/** Longueur maximale de la bio publique (contrainte SQL `profiles_bio_length`). */
export const PROFILE_BIO_MAX = 500;

/** Bornes des sélections (mêmes que les contraintes SQL de 00080). */
export const COLLECTION_TITLE_MAX = 80;
export const COLLECTION_DESCRIPTION_MAX = 500;
export const COLLECTION_MAX_ITEMS = 50;

/** Nombre de profils renvoyés par une recherche de mélomanes. */
export const PEOPLE_SEARCH_LIMIT = 20;
/** Délai avant de lancer une recherche de mélomanes pendant la frappe. */
export const PEOPLE_SEARCH_DEBOUNCE_MS = 300;

/**
 * Transforme une saisie (« Awa Dossou ») en identifiant valide
 * (`awa.dossou`) : minuscules, sans accents, espaces en points, seuls
 * lettres, chiffres, `.`, `_` et `-`, ni ponctuation en bordure.
 */
export function normalizeHandle(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/([._-])[._-]+/g, '$1')
    .replace(/^[._-]+/, '')
    .slice(0, HANDLE_MAX)
    .replace(/[._-]+$/, '');
}

export function isValidHandle(handle: string): boolean {
  return HANDLE_RE.test(handle);
}

/** Identifiant proposé à partir du nom affiché, complété si trop court. */
export function suggestHandle(displayName: string | null | undefined, fallback = 'melomane'): string {
  const base = normalizeHandle(displayName ?? '');
  if (isValidHandle(base)) return base;
  return normalizeHandle(`${base || fallback}.musimaps`);
}

/** Carte d'identité publique d'un compte (auteur, abonné, résultat de recherche). */
export interface PublicPerson {
  id: string;
  /** `null` quand le profil n'est pas public : pas de lien vers une page. */
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  city: string | null;
  country: string | null;
  role: 'artist' | 'melomane';
}

export interface CollectionArtist {
  id: string;
  name: string;
  image: string | null;
  city: string | null;
  country?: string | null;
  genre: string | null;
  slug?: string | null;
}

export interface CollectionSummary {
  id: string;
  title: string;
  description: string;
  isPublic: boolean;
  updatedAt: string;
  itemCount: number;
  likeCount: number;
  /** Jusqu'à 4 photos d'artistes pour la vignette. */
  covers: (string | null)[];
  /** Présent dans le fil des mélomanes suivis. */
  owner?: PublicPerson;
}

export interface CollectionDetail extends CollectionSummary {
  owner: PublicPerson;
  isMine: boolean;
  likedByMe: boolean;
  artists: CollectionArtist[];
}

export interface PublicProfile extends PublicPerson {
  bio: string;
  favoriteGenres: string[];
  isPublic: boolean;
  isMe: boolean;
  joinedAt: string;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  followedArtists: CollectionArtist[];
  collections: CollectionSummary[];
}

export type CommunityResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): CommunityResult => ({ ok: false, error });

async function currentUserId(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// ------------------------------------------------------------
// Profil public
// ------------------------------------------------------------

/** État du profil public du compte connecté (lecture de sa propre ligne). */
export async function fetchMyPublicSettings(): Promise<{ isPublic: boolean; handle: string | null; bio: string } | null> {
  const supabase = getSupabase();
  const me = await currentUserId();
  if (!supabase || !me) return null;
  const { data, error } = await supabase.from('profiles').select('is_public, handle, bio').eq('id', me).maybeSingle();
  if (error || !data) return null;
  const row = data as { is_public: boolean | null; handle: string | null; bio: string | null };
  return { isPublic: Boolean(row.is_public), handle: row.handle, bio: row.bio ?? '' };
}

/**
 * Active ou coupe le profil public. Erreurs : `handle_invalid`,
 * `handle_taken`, `not_authenticated`.
 */
export async function setPublicProfile(isPublic: boolean, handle: string): Promise<CommunityResult> {
  const supabase = getSupabase();
  if (!supabase) return fail('unavailable');
  const clean = normalizeHandle(handle);
  if (isPublic && !isValidHandle(clean)) return fail('handle_invalid');
  const { data, error } = await supabase.rpc('set_public_profile', { p_public: isPublic, p_handle: clean });
  if (error) return fail(error.message);
  const result = data as { ok: boolean; error?: string } | null;
  return result?.ok ? { ok: true } : fail(result?.error ?? 'unknown');
}

export async function fetchPublicProfile(handle: string): Promise<PublicProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_public_profile', { p_handle: handle });
  if (error || !data) return null;
  return data as PublicProfile;
}

export async function searchPeople(query: string): Promise<PublicPerson[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('search_public_profiles', {
    p_query: query.trim(),
    p_limit: PEOPLE_SEARCH_LIMIT,
  });
  if (error || !Array.isArray(data)) return [];
  return data as PublicPerson[];
}

export async function fetchFollowedPeople(): Promise<PublicPerson[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('my_followed_people');
  if (error || !Array.isArray(data)) return [];
  return data as PublicPerson[];
}

// ------------------------------------------------------------
// Suivre un mélomane
// ------------------------------------------------------------

export async function followPerson(userId: string): Promise<CommunityResult> {
  const supabase = getSupabase();
  if (!supabase) return fail('unavailable');
  if (!(await currentUserId())) return fail('auth');
  const { error } = await supabase
    .from('user_follows')
    .upsert({ followee_id: userId }, { onConflict: 'follower_id,followee_id', ignoreDuplicates: true });
  return error ? fail(error.message) : { ok: true };
}

export async function unfollowPerson(userId: string): Promise<CommunityResult> {
  const supabase = getSupabase();
  const me = await currentUserId();
  if (!supabase) return fail('unavailable');
  if (!me) return fail('auth');
  const { error } = await supabase.from('user_follows').delete().eq('follower_id', me).eq('followee_id', userId);
  return error ? fail(error.message) : { ok: true };
}

// ------------------------------------------------------------
// Sélections
// ------------------------------------------------------------

/** Sélections du compte connecté, avec leur nombre d'artistes. */
export async function fetchMyCollections(): Promise<CollectionSummary[]> {
  const supabase = getSupabase();
  const me = await currentUserId();
  if (!supabase || !me) return [];
  const { data, error } = await supabase
    .from('collections')
    .select('id, title, description, is_public, updated_at, collection_items(artist_id)')
    .eq('owner_id', me)
    .order('updated_at', { ascending: false });
  if (error || !data) return [];
  return (data as {
    id: string; title: string; description: string; is_public: boolean; updated_at: string;
    collection_items: { artist_id: string }[] | null;
  }[]).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    isPublic: row.is_public,
    updatedAt: row.updated_at,
    itemCount: row.collection_items?.length ?? 0,
    likeCount: 0,
    covers: [],
  }));
}

/** Identifiants des sélections du compte qui contiennent déjà cet artiste. */
export async function fetchCollectionsContaining(artistId: string): Promise<string[]> {
  const supabase = getSupabase();
  const me = await currentUserId();
  if (!supabase || !me) return [];
  const { data, error } = await supabase
    .from('collection_items')
    .select('collection_id, collections!inner(owner_id)')
    .eq('artist_id', artistId)
    .eq('collections.owner_id', me);
  if (error || !data) return [];
  return (data as { collection_id: string }[]).map((row) => row.collection_id);
}

export async function createCollection(params: {
  title: string;
  description?: string;
  isPublic?: boolean;
}): Promise<{ id: string } | { error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { error: 'unavailable' };
  if (!(await currentUserId())) return { error: 'auth' };
  const title = params.title.trim().slice(0, COLLECTION_TITLE_MAX);
  if (!title) return { error: 'title_required' };
  const { data, error } = await supabase
    .from('collections')
    .insert({
      title,
      description: (params.description ?? '').trim().slice(0, COLLECTION_DESCRIPTION_MAX),
      is_public: params.isPublic ?? true,
    })
    .select('id')
    .single();
  if (error || !data) return { error: error?.message ?? 'unknown' };
  return { id: (data as { id: string }).id };
}

export async function updateCollection(
  id: string,
  patch: { title?: string; description?: string; isPublic?: boolean },
): Promise<CommunityResult> {
  const supabase = getSupabase();
  if (!supabase) return fail('unavailable');
  const row: Record<string, string | boolean> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) {
    const title = patch.title.trim().slice(0, COLLECTION_TITLE_MAX);
    if (!title) return fail('title_required');
    row.title = title;
  }
  if (patch.description !== undefined) row.description = patch.description.trim().slice(0, COLLECTION_DESCRIPTION_MAX);
  if (patch.isPublic !== undefined) row.is_public = patch.isPublic;
  const { error } = await supabase.from('collections').update(row).eq('id', id);
  return error ? fail(error.message) : { ok: true };
}

export async function deleteCollection(id: string): Promise<CommunityResult> {
  const supabase = getSupabase();
  if (!supabase) return fail('unavailable');
  const { error } = await supabase.from('collections').delete().eq('id', id);
  return error ? fail(error.message) : { ok: true };
}

/** Ajoute un artiste à une sélection (`collection_full` au-delà du plafond). */
export async function addToCollection(collectionId: string, artistId: string): Promise<CommunityResult> {
  const supabase = getSupabase();
  if (!supabase) return fail('unavailable');
  const { error } = await supabase
    .from('collection_items')
    .upsert({ collection_id: collectionId, artist_id: artistId }, { onConflict: 'collection_id,artist_id', ignoreDuplicates: true });
  if (error) return fail(/collection_full/.test(error.message) ? 'collection_full' : error.message);
  return { ok: true };
}

export async function removeFromCollection(collectionId: string, artistId: string): Promise<CommunityResult> {
  const supabase = getSupabase();
  if (!supabase) return fail('unavailable');
  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('collection_id', collectionId)
    .eq('artist_id', artistId);
  return error ? fail(error.message) : { ok: true };
}

export async function fetchCollection(id: string): Promise<CollectionDetail | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('get_collection', { p_id: id });
  if (error || !data) return null;
  return data as CollectionDetail;
}

/** Dernières sélections publiques des mélomanes suivis. */
export async function fetchFollowingCollections(): Promise<CollectionSummary[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('following_collections', { p_limit: 20 });
  if (error || !Array.isArray(data)) return [];
  return data as CollectionSummary[];
}

export async function likeCollection(collectionId: string): Promise<CommunityResult> {
  const supabase = getSupabase();
  if (!supabase) return fail('unavailable');
  if (!(await currentUserId())) return fail('auth');
  const { error } = await supabase
    .from('collection_likes')
    .upsert({ collection_id: collectionId }, { onConflict: 'user_id,collection_id', ignoreDuplicates: true });
  return error ? fail(error.message) : { ok: true };
}

export async function unlikeCollection(collectionId: string): Promise<CommunityResult> {
  const supabase = getSupabase();
  const me = await currentUserId();
  if (!supabase) return fail('unavailable');
  if (!me) return fail('auth');
  const { error } = await supabase
    .from('collection_likes')
    .delete()
    .eq('user_id', me)
    .eq('collection_id', collectionId);
  return error ? fail(error.message) : { ok: true };
}
