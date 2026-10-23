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
 *     et les champs `avatarUrl` du web.
 */
import { getResetPasswordUrl, getSignUpConfirmationUrl, getSupabase } from '../runtime';
import { normalizeArtistImageUrl } from './media';

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

/**
 * Passage en compte business / premium depuis l'app. Désactivé tant que les
 * offres ne sont pas prêtes : les boutons sont masqués sur web et mobile.
 */
export const ACCOUNT_UPGRADES_ENABLED = false;

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
  /**
   * `false` quand le rôle n'a jamais été choisi : compte créé par Google ou
   * Apple, que le trigger a mis en mélomane par défaut. Absent = choisi.
   */
  roleConfirmed?: boolean;
}

/** Ce qu'une connexion Google/Apple ne fournit pas et que l'inscription demande. */
export type ProfileGap = 'role' | 'name' | 'location';

/**
 * Champs à réclamer avant d'utiliser le compte : rôle, nom, ville et pays —
 * les mêmes que l'inscription par e-mail exige (`validateSignupStep`).
 */
export function profileGaps(profile: UserProfile): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if (profile.roleConfirmed === false) gaps.push('role');
  if (!profile.displayName?.trim()) gaps.push('name');
  if (!profile.city?.trim() || !profile.country?.trim()) gaps.push('location');
  return gaps;
}

/**
 * Le rôle reste à choisir seulement pour un compte créé par Google ou Apple
 * qui ne l'a pas encore donné : l'inscription par e-mail l'exige toujours.
 */
function metadataRoleConfirmed(user: AuthUserLike): boolean {
  const provider = user.app_metadata?.provider;
  if (provider !== 'google' && provider !== 'apple') return true;
  const role = (user.user_metadata ?? {}).role;
  return role === 'artist' || role === 'melomane';
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
      emailRedirectTo: getSignUpConfirmationUrl() || undefined,
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
  const profile = await fetchProfile(data.user.id, data.user.email ?? params.email.trim(), data.user);
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
      avatarUrl: metadataAvatarUrl(data.user),
    },
    error: null,
    needsConfirmation: false,
  };
}

/** Renvoie le mail de validation quand le premier envoi n'est pas arrivé. */
export async function resendSignUpConfirmation(email: string): Promise<{ error: AuthError | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: 'Supabase non configuré' } };
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
    options: { emailRedirectTo: getSignUpConfirmationUrl() || undefined },
  });
  return { error: error ? { message: error.message } : null };
}

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
  /** `provider` : 'email', 'google' ou 'apple' — fixé par Supabase. */
  app_metadata?: { provider?: string } | null;
};

/**
 * Photo fournie par le fournisseur d'identité (Google, Apple, etc.).
 * Certaines anciennes sessions n'ont pas encore copié cette valeur dans
 * `profiles.avatar_url` : elle reste néanmoins une source commune aux deux
 * apps tant que le profil est en cours de migration.
 */
function metadataAvatarUrl(user: AuthUserLike): string | null {
  const metadata = user.user_metadata ?? {};
  for (const key of ['avatar_url', 'avatarUrl', 'picture', 'photo_url', 'image']) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return normalizeArtistImageUrl(value);
  }
  return null;
}

/**
 * Nom choisi à l'inscription, sinon celui fourni par Google ou Apple
 * (`full_name` / `name`) : un compte créé par fournisseur n'a pas de
 * `display_name`.
 */
function metadataDisplayName(user: AuthUserLike): string | null {
  const metadata = user.user_metadata ?? {};
  for (const key of ['display_name', 'full_name', 'name']) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** Profil de session sûr pendant que le trigger `profiles` termine son travail. */
function sessionShell(user: AuthUserLike): UserProfile {
  const meta = user.user_metadata ?? {};
  const email = user.email ?? '';
  const displayName = metadataDisplayName(user) ?? (email.split('@')[0] || 'Musimaps');
  return {
    id: user.id,
    email,
    displayName,
    city: typeof meta.city === 'string' ? meta.city : null,
    district: null,
    country: typeof meta.country === 'string' ? meta.country : null,
    role: meta.role === 'artist' ? 'artist' : 'melomane',
    accountType: 'personal',
    favoriteGenres: [],
    avatarUrl: metadataAvatarUrl(user),
    roleConfirmed: metadataRoleConfirmed(user),
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
  const profile = await fetchProfile(data.user.id, data.user.email ?? null, data.user) ?? sessionShell(data.user);
  // Rattache sa ligne waitlist / son pin à ce compte (migration 00053).
  if (profile?.role === 'artist') void linkArtistAccountToMap();
  return { user: profile, error: null };
}

/** Fournisseurs d'identité proposés à côté de l'e-mail. */
export type OAuthProvider = 'google' | 'apple';

/**
 * Fournisseurs affichés par surface, dans l'ordre des boutons. Apple est
 * natif sur iOS, où l'App Store l'exige dès qu'un autre fournisseur est
 * proposé (règle 4.8). Sur le web, Apple passe par un Services ID et un
 * secret à régénérer tous les 6 mois (`scripts/apple-client-secret.mjs`).
 */
export const OAUTH_PROVIDERS = {
  web: ['google', 'apple'],
  android: ['google'],
  ios: ['apple', 'google'],
} as const satisfies Record<'web' | 'android' | 'ios', readonly OAuthProvider[]>;

/**
 * Démarre la connexion Google/Apple via Supabase. Le web laisse Supabase
 * rediriger la page ; le mobile passe `skipBrowserRedirect` et ouvre lui-même
 * l'URL renvoyée dans un navigateur in-app, puis appelle
 * `completeOAuthSignIn` avec l'URL de retour (`musimaps://login…`).
 */
export async function startOAuthSignIn(
  provider: OAuthProvider,
  options: { redirectTo: string; skipBrowserRedirect?: boolean },
): Promise<{ url: string | null; error: AuthError | null }> {
  const supabase = getSupabase();
  if (!supabase) return { url: null, error: { message: 'Supabase non configuré' } };
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: options.redirectTo, skipBrowserRedirect: options.skipBrowserRedirect },
  });
  return { url: data?.url ?? null, error: error ? { message: error.message } : null };
}

/** Paramètres d'une URL de retour d'authentification, query ET fragment. */
export function parseAuthCallbackUrl(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const parts = [url.split('#')[1] ?? '', (url.split('#')[0].split('?')[1]) ?? ''];
  for (const part of parts) {
    for (const pair of part.split('&')) {
      if (!pair) continue;
      const [key, value = ''] = pair.split('=');
      params[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, ' '));
    }
  }
  return params;
}

/**
 * Termine une connexion par fournisseur à partir de l'URL de retour :
 * `?code=` (flux PKCE) ou `#access_token=…&refresh_token=…` (flux implicite).
 */
export async function completeOAuthSignIn(url: string): Promise<{ error: AuthError | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: 'Supabase non configuré' } };
  const params = parseAuthCallbackUrl(url);
  if (params.error_description || params.error) {
    return { error: { message: params.error_description || params.error } };
  }
  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    return { error: error ? { message: error.message } : null };
  }
  if (params.access_token && params.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    return { error: error ? { message: error.message } : null };
  }
  return { error: { message: 'missing_token' } };
}

/**
 * Connexion « Se connecter avec Apple » native (iOS) : le jeton d'identité
 * fourni par Apple est vérifié par Supabase, sans passer par le navigateur.
 * `nonce` est la valeur brute dont le SHA-256 a été transmis à Apple.
 */
export async function signInWithAppleIdToken(
  idToken: string,
  nonce: string,
  fullName?: string | null,
): Promise<{ error: AuthError | null }> {
  const supabase = getSupabase();
  if (!supabase) return { error: { message: 'Supabase non configuré' } };
  const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: idToken, nonce });
  if (error) return { error: { message: error.message } };
  // Apple ne transmet le nom qu'à la toute première connexion, et jamais dans
  // le jeton : on le garde dans les métadonnées pour le profil.
  if (fullName?.trim()) await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
  return { error: null };
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

/**
 * Vérifie le mot de passe actuel en ré-authentifiant (email + password).
 * Utilisé par « Changer le mot de passe » pour exiger le mot de passe actuel
 * avant la mise à jour : l'API GoTrue ne permet pas de le vérifier autrement.
 */
export async function verifyCurrentPassword(
  email: string,
  password: string,
): Promise<{ ok: boolean; error: { message: string } | null }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: { message: 'Supabase non configuré' } };
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) return { ok: false, error: { message: error.message } };
  return { ok: true, error: null };
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
 * garde le champ `avatarUrl` du web et le repli « colonne récente absente »
 * du mobile, qui protège les bases antérieures à leur ajout.
 */
export async function updateProfile(params: {
  /** Choix artiste / mélomane — réclamé après une connexion Google ou Apple. */
  role?: AccountRole;
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
  if (params.role !== undefined) {
    patch.role = params.role;
    // Les métadonnées gardent la trace du choix : `roleConfirmed` en dépend.
    await supabase.auth.updateUser({ data: { role: params.role } });
  }
  // Colonne bio ajoutée par 00080 (bio du profil public) : on peut aussi la
  // vider. Sur une base plus ancienne, le repli ci-dessous la retire.
  if (params.bio !== undefined) patch.bio = params.bio.trim();

  const { error } = await supabase.from('profiles').update(patch).eq('id', data.user.id);
  if (error && /column|schema|does not exist/i.test(error.message)) {
    // Colonne absente (ancienne base, migration pas encore appliquée)
    // : on retire les colonnes problématiques et on retente.
    const missing = {
      bio: /bio/i.test(error.message),
      district: /district/i.test(error.message),
      avatar: /avatar/i.test(error.message),
    };
    const retry: Record<string, string | string[] | null> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'bio' && missing.bio) continue;
      if (key === 'district' && missing.district) continue;
      if (key === 'avatar_url' && missing.avatar) continue;
      // Les anciennes API peuvent renvoyer une erreur générique sans le nom
      // de la colonne : on garde alors le repli historique.
      if (!missing.bio && !missing.district && !missing.avatar && /bio|district|avatar/i.test(key)) continue;
      retry[key] = value;
    }
    if (Object.keys(retry).length === 0) return { error: { message: error.message } };
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
  sessionUser?: AuthUserLike,
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
    if (full.error && /account_type|favorite_genres|district|country|avatar_url|column .* does not exist|schema cache/i.test(full.error.message)) {
      // Déploiement progressif : si seule une colonne récente manque, garder
      // les autres colonnes du profil (pays, genres et avatar compris).
      const compatible = await supabase
        .from('profiles')
        .select('id, display_name, city, district, country, role, account_type, favorite_genres, avatar_url')
        .eq('id', userId)
        .maybeSingle();
      if (!compatible.error) {
        data = (compatible.data as ProfileRow | null) ?? null;
        error = null;
      } else {
        const base = await supabase
          .from('profiles')
          .select('id, display_name, city, role')
          .eq('id', userId)
          .maybeSingle();
        data = (base.data as ProfileRow | null) ?? null;
        error = base.error ? { message: base.error.message } : null;
      }
    } else {
      data = (full.data as ProfileRow | null) ?? null;
      error = full.error ? { message: full.error.message } : null;
    }
    if (error) return null;

    if (data) {
      let avatarUrl = data.avatar_url
        ? normalizeArtistImageUrl(data.avatar_url)
        : (sessionUser ? metadataAvatarUrl(sessionUser) : null);
      // Photo de la demande de référencement liée au compte : elle sert
      // d'avatar tant que le profil n'a pas de photo propre, quel que soit le
      // rôle du compte (un mélomane peut aussi proposer un artiste).
      if (!avatarUrl) {
        try {
          const { data: ref } = await supabase.rpc('my_referral_request');
          if (ref && typeof ref === 'object' && 'photo' in ref && (ref as { photo?: string | null }).photo) {
            avatarUrl = normalizeArtistImageUrl((ref as { photo: string }).photo);
          }
        } catch {
          // Best-effort : la migration 00045 peut ne pas être appliquée.
        }
      }
      return {
        id: userId,
        email: email ?? '',
        displayName: data.display_name ?? (sessionUser ? metadataDisplayName(sessionUser) : null),
        city: data.city,
        district: data.district ?? null,
        country: data.country ?? null,
        role: data.role === 'artist' ? 'artist' : 'melomane',
        accountType: toAccountType(data.account_type),
        favoriteGenres: data.favorite_genres ?? [],
        avatarUrl,
        roleConfirmed: sessionUser ? metadataRoleConfirmed(sessionUser) : undefined,
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
  const profile = await fetchProfile(data.user.id, data.user.email ?? null, data.user) ?? sessionShell(data.user);
  // Artiste déjà connecté (session restaurée) : rattache sa ligne waitlist /
  // son pin à ce compte — couvre les comptes créés AVANT le déploiement 00053.
  if (profile?.role === 'artist') void linkArtistAccountToMap();
  return profile;
}
