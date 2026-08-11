import { supabase } from './supabase';

export type AccountRole = 'artist' | 'melomane';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  role: AccountRole;
  accountType?: 'personal' | 'business' | 'premium';
}

export interface AuthError {
  message: string;
}

export interface SignUpResult {
  user: UserProfile | null;
  error: AuthError | null;
  /** true si la confirmation par email est requise (session pas encore créée). */
  needsConfirmation: boolean;
}

/**
 * Rattache le compte connecté à sa ligne waitlist et à son pin carte
 * (migration 00053). Best-effort — appelé après login/inscription.
 */
export async function linkArtistAccountToMap(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc('link_waitlist_to_account');
  } catch {
    // Best-effort : le RPC peut ne pas être déployé, on ignore.
  }
}

/** Inscription avec rôle artiste ou mélomane (profil créé par trigger). */
export async function signUp(params: {
  email: string;
  password: string;
  role: AccountRole;
  displayName: string;
  city: string;
  country: string;
}): Promise<SignUpResult> {
  if (!supabase) return { user: null, error: { message: 'Supabase non configuré' }, needsConfirmation: false };
  const { data, error } = await supabase.auth.signUp({
    email: params.email.trim(),
    password: params.password,
    options: {
      data: {
        role: params.role,
        display_name: params.displayName.trim(),
        city: params.city.trim(),
        country: params.country.trim(),
      },
    },
  });
  if (error) return { user: null, error: { message: error.message }, needsConfirmation: false };
  if (!data.user) return { user: null, error: null, needsConfirmation: false };
  // Pas de session => confirmation email requise : on ne simule pas une connexion.
  if (!data.session) return { user: null, error: null, needsConfirmation: true };
  const profile = await fetchProfile(data.user.id, data.user.email ?? params.email.trim());
  // Rattache sa ligne waitlist (formulaire rempli avant le compte) à ce compte.
  if (profile?.role === 'artist') void linkArtistAccountToMap();
  if (profile) return { user: profile, error: null, needsConfirmation: false };
  // Le trigger n'a pas encore créé la ligne : shell minimal (le listener le remplacera).
  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? params.email.trim(),
      displayName: params.displayName.trim(),
      city: params.city.trim(),
      district: null,
      country: params.country.trim(),
      role: params.role,
    },
    error: null,
    needsConfirmation: false,
  };
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: UserProfile | null; error: AuthError | null }> {
  if (!supabase) return { user: null, error: { message: 'Supabase non configuré' } };
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { user: null, error: { message: error.message } };
  if (!data.user) return { user: null, error: null };
  const profile = await fetchProfile(data.user.id, data.user.email ?? null);
  // Rattache sa ligne waitlist / son pin à ce compte (migration 00053).
  if (profile?.role === 'artist') void linkArtistAccountToMap();
  return { user: profile, error: null };
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/** Envoie un email de réinitialisation de mot de passe (deep link → musimaps://reset-password). */
export async function resetPasswordForEmail(
  email: string,
): Promise<AuthError | null> {
  if (!supabase) return { message: 'Supabase non configuré' };
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: 'musimaps://reset-password',
  });
  return error ? { message: error.message } : null;
}

/** Lit le profil (rôle) de l'utilisateur, avec petite réattente pour laisser
 *  le trigger handle_new_user créer la ligne. */
export async function fetchProfile(
  userId: string,
  email: string | null,
): Promise<UserProfile | null> {
  if (!supabase) return null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let data: {
      display_name: string | null;
      city: string | null;
      district?: string | null;
      country: string | null;
      role: string | null;
      account_type?: string | null;
    } | null = null;
    let error: { message: string } | null = null;
    const full = await supabase
      .from('profiles')
      .select('id, display_name, city, district, country, role, account_type')
      .eq('id', userId)
      .maybeSingle();
    if (full.error && /account_type/i.test(full.error.message)) {
      // Base très ancienne (colonnes country/account_type absentes) : repli tolérant.
      const base = await supabase
        .from('profiles')
        .select('id, display_name, city, role')
        .eq('id', userId)
        .maybeSingle();
      data = (base.data as unknown as {
        display_name: string | null;
        city: string | null;
        country: string | null;
        role: string | null;
      }) ?? null;
      error = base.error ? { message: base.error.message } : null;
    } else {
      data = full.data ?? null;
      error = full.error ? { message: full.error.message } : null;
    }
    if (error) return null;
    if (data) {
      return {
        id: userId,
        email: email ?? '',
        displayName: data.display_name,
        city: data.city,
        district: data.district ?? null,
        country: data.country ?? null,
        role: data.role === 'artist' ? 'artist' : 'melomane',
        accountType: data.account_type === 'business' ? 'business' : data.account_type === 'premium' ? 'premium' : 'personal',
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  return null;
}

export async function getSessionProfile(): Promise<UserProfile | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const profile = await fetchProfile(data.user.id, data.user.email ?? null);
  // Artiste déjà connecté (session restaurée) : rattache sa ligne waitlist /
  // son pin à ce compte — couvre les comptes créés AVANT le déploiement 00053.
  if (profile?.role === 'artist') void linkArtistAccountToMap();
  return profile;
}

/** Change le mot de passe (session valide requise). */
export async function updatePassword(
  newPassword: string,
): Promise<AuthError | null> {
  if (!supabase) return { message: 'Supabase non configuré' };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return error ? { message: error.message } : null;
}

/** Change l'adresse email du compte (confirmation sur la nouvelle adresse). */
export async function updateEmail(newEmail: string): Promise<AuthError | null> {
  if (!supabase) return { message: 'Supabase non configuré' };
  const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
  return error ? { message: error.message } : null;
}

/** Bascule le type de compte (business / premium) — RPC partagé avec le web. */
export async function setAccountType(
  type: 'personal' | 'business' | 'premium',
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase non configuré' };
  const { data, error } = await supabase.rpc('set_account_type', { p_type: type });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? 'Erreur inconnue' };
}

/** Supprime définitivement le compte (migration 00048). */
export async function deleteAccount(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase non configuré' };
  const { data, error } = await supabase.rpc('delete_my_account', {
    p_email: email,
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? 'Erreur inconnue' };
}

/** Sync le profil de compte vers la table profiles (même données que le web). */
export async function syncProfileToSupabase(params: {
  displayName?: string;
  city?: string;
  district?: string;
  country?: string;
  bio?: string;
  favoriteGenres?: string[];
}): Promise<void> {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const patch: Record<string, string | string[] | null> = {};
  if (params.displayName !== undefined) patch.display_name = params.displayName.trim();
  if (params.city !== undefined) patch.city = params.city.trim();
  if (params.district !== undefined) patch.district = params.district.trim();
  if (params.country !== undefined) patch.country = params.country.trim();
  if (params.bio !== undefined) patch.bio = params.bio.trim();
  if (params.favoriteGenres !== undefined) {
    patch.favorite_genres = params.favoriteGenres.map((g) => g.trim()).filter(Boolean);
  }
  // Bio incluse uniquement si non vide : évite un double-écriture permanent
  // sur les bases où la colonne bio n'existe pas.
  if (!params.bio?.trim()) delete patch.bio;
  const { error } = await supabase.from('profiles').update(patch).eq('id', data.user.id);
  // Colonne bio absente (ancienne base) : on retente sans bio.
  if (error && /bio/i.test(error.message)) {
    const retryPatch: Record<string, string | string[] | null> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (key !== 'bio') retryPatch[key] = value as string | string[] | null;
    }
    await supabase.from('profiles').update(retryPatch).eq('id', data.user.id);
  }
}
