/**
 * Authentification et profil de compte — partagé web + mobile.
 *
 * Réunion de `auth.ts` (web) et `auth.ts` (mobile), plus `setAccountType`
 * qui vivait dans `discovery.ts` côté web. Trois divergences ont été
 * arbitrées par le schéma de la base plutôt que par préférence :
 *
 *  1. `accountType` — le web ignorait la valeur 'premium', pourtant admise
 *     par la contrainte depuis la migration 00029. Voir `AccountType`.
 *  2. `resetPasswordForEmail` — le web renvoyait `{ error }`, le mobile
 *     `AuthError | null`. Unifié sur `{ error }` (même forme que les autres).
 *  3. `updateProfile` / `syncProfileToSupabase` — même fonction sous deux
 *     noms. Fusionnées, en gardant le repli « colonne bio absente » du mobile
 *     et le champ `avatarUrl` du web.
 */
import { getResetPasswordUrl, getSupabase } from '../runtime';

export type AccountRole = 'artist' | 'melomane';

/**
 * Type de compte. Les TROIS valeurs sont admises en base :
 * `CHECK (account_type IN ('personal', 'business', 'premium'))`
 * — contrainte étendue par la migration 00029 (liens illimités, notifs).
 *
 * Le typage web s'était arrêté à `'personal' | 'business'` et son
 * `fetchProfile` écrasait `premium` en `personal`, ce qui permettait au
 * dashboard de rétrograder silencieusement un compte premium.
 */
export type AccountType = 'personal' | 'business' | 'premium';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  city: string | null;
  district: string | null;
  country: string | null;
  role: AccountRole;
  accountType?: AccountType;
  favoriteGenres?: string[];
  /** Photo du compte (avatar) — synchro depuis la demande de référencement. */
  avatarUrl: string | null;
}

export interface AuthError {
  message: string;
  /** Champ de formulaire à mettre en erreur (web). */
  field?: 'email' | 'password' | 'name' | 'city' | 'role';
}

export interface SignUpResult {
  user: UserProfile | null;
  error: AuthError | null;
  /** true si la confirmation par email est requise (session pas encore créée). */
  needsConfirmation: boolean;
}

/** Normalise la valeur brute de `account_type` sans jamais perdre un palier. */
function toAccountType(raw: unknown): AccountType {
  if (raw === 'business') return 'business';
  if (raw === 'premium') return 'premium';
  return 'personal';
}

/**
 * Rattache le compte connecté à sa ligne waitlist et à son pin carte
 * (migration 00053). Best-effort : si l'utilisateur a soumis la demande
 * de référencement AVANT de créer son compte, ce rattrapage lie le compte
 * à la carte (claimed_by) au prochain login / à l'inscription.
 */
export async function linkArtistAccountToMap(): Promise<void> {
  const supabase = getSupabase();
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
  const supabase = getSupabase();
  if (!supabase) {
    return { user: null, error: { message: 'Supabase non configuré' }, needsConfirmation: false };
  }
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
  // Le trigger n'a pas encore créé la ligne : on renvoie un shell minimal
  // (le listener onAuthStateChange le remplacera par le vrai profil).
  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? params.email.trim(),
      displayName: params.displayName.trim(),
      city: params.city.trim(),
      district: null,
      country: params.country.trim(),
      role: params.role,
      accountType: 'personal',
      avatarUrl: null,
    },
    error: null,
    needsConfirmation: false,
  };
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: UserProfile | null; error: AuthError | null }> {
  const supabase = getSupabase();
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
  await getSupabase()?.auth.signOut();
}

/**
 * Envoie un email de réinitialisation de mot de passe. La cible du lien est
 * injectée par l'app (`resetPasswordUrl`) : URL HTTP côté web, deep link
 * `musimaps://reset-password` côté mobile.
 */
export async function resetPasswordForEmail(
  email: string,
): Promise<{ error: AuthError | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: 'Supabase non configuré' } };
  const redirectTo = getResetPasswordUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim(),
    redirectTo ? { redirectTo } : undefined,
  );
  return { error: error ? { message: error.message } : null };
}

/** Enregistre le nouveau mot de passe (session de récupération active). */
export async function updatePassword(
  newPassword: string,
): Promise<{ error: AuthError | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: 'Supabase non configuré' } };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  return { error: error ? { message: error.message } : null };
}

/** Change l'adresse email du compte (confirmation sur la nouvelle adresse). */
export async function updateEmail(newEmail: string): Promise<{ error: AuthError | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: 'Supabase non configuré' } };
  const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
  return { error: error ? { message: error.message } : null };
}

/**
 * Met à jour le profil de l'utilisateur connecté (nom, ville, genres, bio,
 * avatar). Seul le propriétaire peut modifier sa propre ligne (RLS).
 *
 * Fusion de `updateProfile` (web) et `syncProfileToSupabase` (mobile) : on
 * garde le champ `avatarUrl` du web et le repli « colonne bio absente » du
 * mobile, qui protège les bases antérieures à l'ajout de la colonne.
 */
export async function updateProfile(params: {
  displayName?: string;
  city?: string;
  district?: string;
  country?: string;
  bio?: string;
  favoriteGenres?: string[];
  avatarUrl?: string | null;
}): Promise<{ error: AuthError | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: 'Supabase non configuré' } };
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: { message: 'Non connecté' } };

  const patch: Record<string, string | string[] | null> = {};
  if (params.displayName !== undefined) patch.display_name = params.displayName.trim();
  if (params.city !== undefined) patch.city = params.city.trim();
  if (params.district !== undefined) patch.district = params.district.trim();
  if (params.country !== undefined) patch.country = params.country.trim();
  if (params.favoriteGenres !== undefined) {
    patch.favorite_genres = params.favoriteGenres.map((g) => g.trim()).filter(Boolean);
  }
  if (params.avatarUrl !== undefined) patch.avatar_url = params.avatarUrl;
  // Bio incluse uniquement si non vide : évite une écriture permanente sur
  // les bases où la colonne n'existe pas.
  if (params.bio !== undefined && params.bio.trim()) patch.bio = params.bio.trim();

  const { error } = await supabase.from('profiles').update(patch).eq('id', data.user.id);
  if (error && /bio/i.test(error.message)) {
    // Colonne bio absente (ancienne base) : on retente sans elle.
    const retry: Record<string, string | string[] | null> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (key !== 'bio') retry[key] = value;
    }
    const second = await supabase.from('profiles').update(retry).eq('id', data.user.id);
    return { error: second.error ? { message: second.error.message } : null };
  }
  return { error: error ? { message: error.message } : null };
}

/** Bascule le type de compte (personal / business / premium). */
export async function setAccountType(
  type: AccountType,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase non configuré' };
  const { data, error } = await supabase.rpc('set_account_type', { p_type: type });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? 'Erreur inconnue' };
}

/** Supprime définitivement le compte (migration 00048). */
export async function deleteAccount(email: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Supabase non configuré' };
  const { data, error } = await supabase.rpc('delete_my_account', { p_email: email });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok ? { ok: true } : { ok: false, error: result?.error ?? 'Erreur inconnue' };
}

interface ProfileRow {
  display_name: string | null;
  city: string | null;
  district?: string | null;
  country: string | null;
  role: string | null;
  account_type?: string | null;
  favorite_genres?: string[] | null;
  avatar_url?: string | null;
}

/**
 * Lit le profil de l'utilisateur, avec petite réattente pour laisser le
 * trigger `handle_new_user` créer la ligne. Tolérant : si une colonne
 * récente n'existe pas encore (migration non appliquée), on retombe sur les
 * colonnes de base plutôt que d'échouer.
 */
export async function fetchProfile(
  userId: string,
  email: string | null,
): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let data: ProfileRow | null = null;
    let error: { message: string } | null = null;

    const full = await supabase
      .from('profiles')
      .select('id, display_name, city, district, country, role, account_type, favorite_genres, avatar_url')
      .eq('id', userId)
      .maybeSingle();
    if (full.error && /account_type|favorite_genres/i.test(full.error.message)) {
      const base = await supabase
        .from('profiles')
        .select('id, display_name, city, role')
        .eq('id', userId)
        .maybeSingle();
      data = (base.data as ProfileRow | null) ?? null;
      error = base.error ? { message: base.error.message } : null;
    } else {
      data = (full.data as ProfileRow | null) ?? null;
      error = full.error ? { message: full.error.message } : null;
    }
    if (error) return null;

    if (data) {
      let avatarUrl = data.avatar_url ?? null;
      // Photo de la demande de référencement en attente : elle sert d'avatar
      // tant que le profil n'a pas de photo propre.
      if (!avatarUrl && data.role === 'artist') {
        try {
          const { data: ref } = await supabase.rpc('my_referral_request');
          if (ref && typeof ref === 'object' && 'photo' in ref && (ref as { photo?: string | null }).photo) {
            avatarUrl = (ref as { photo: string }).photo;
          }
        } catch {
          // Best-effort : la migration 00045 peut ne pas être appliquée.
        }
      }
      return {
        id: userId,
        email: email ?? '',
        displayName: data.display_name,
        city: data.city,
        district: data.district ?? null,
        country: data.country ?? null,
        role: data.role === 'artist' ? 'artist' : 'melomane',
        accountType: toAccountType(data.account_type),
        favoriteGenres: data.favorite_genres ?? [],
        avatarUrl,
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
  }
  return null;
}

/** Récupère la session courante + le profil. */
export async function getSessionProfile(): Promise<UserProfile | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const profile = await fetchProfile(data.user.id, data.user.email ?? null);
  // Artiste déjà connecté (session restaurée) : rattache sa ligne waitlist /
  // son pin à ce compte — couvre les comptes créés AVANT le déploiement 00053.
  if (profile?.role === 'artist') void linkArtistAccountToMap();
  return profile;
}
