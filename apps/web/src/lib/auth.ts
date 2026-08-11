import { supabase, hasSupabase } from './supabase'

export type AccountRole = 'artist' | 'melomane'

export interface UserProfile {
  id: string
  email: string
  displayName: string | null
  city: string | null
  district: string | null
  country: string | null
  role: AccountRole
  accountType?: 'personal' | 'business'
  favoriteGenres?: string[]
  /** Photo du compte (avatar) — synchro depuis la demande de référencement. */
  avatarUrl: string | null
}

export interface AuthError {
  message: string
  field?: 'email' | 'password' | 'name' | 'city' | 'role'
}

export interface SignUpResult {
  user: UserProfile | null
  error: AuthError | null
  /** true si la confirmation par email est requise (session pas encore créée). */
  needsConfirmation: boolean
}

/**
 * Rattache le compte connecté à sa ligne waitlist et à son pin carte
 * (migration 00053). Best-effort : si l'utilisateur a soumis la demande
 * de référencement AVANT de créer son compte, ce rattrapage lie le compte
 * à la carte (claimed_by) au prochain login / à l'inscription.
 */
export async function linkArtistAccountToMap(): Promise<void> {
  if (!hasSupabase()) return
  try {
    await supabase!.rpc('link_waitlist_to_account')
  } catch {
    // Best-effort : le RPC peut ne pas être déployé, on ignore.
  }
}

/** Inscription avec rôle artiste ou mélomane (profil créé par trigger). */
export async function signUp(params: {
  email: string
  password: string
  role: AccountRole
  displayName: string
  city: string
  country: string
}): Promise<SignUpResult> {
  if (!hasSupabase()) return { user: null, error: { message: 'Supabase non configuré' }, needsConfirmation: false }
  const { data, error } = await supabase!.auth.signUp({
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
  })
  if (error) return { user: null, error: { message: error.message }, needsConfirmation: false }
  if (!data.user) return { user: null, error: null, needsConfirmation: false }
  // Pas de session => confirmation email requise : on ne simule pas une connexion.
  if (!data.session) return { user: null, error: null, needsConfirmation: true }
  const profile = await fetchProfile(data.user.id, data.user.email ?? params.email.trim())
  // Rattache sa ligne waitlist (formulaire rempli avant le compte) à ce compte.
  if (profile?.role === 'artist') void linkArtistAccountToMap()
  if (profile) return { user: profile, error: null, needsConfirmation: false }
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
  }
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: UserProfile | null; error: AuthError | null }> {
  if (!hasSupabase()) return { user: null, error: { message: 'Supabase non configuré' } }
  const { data, error } = await supabase!.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) return { user: null, error: { message: error.message } }
  if (!data.user) return { user: null, error: null }
  const profile = await fetchProfile(data.user.id, data.user.email ?? null)
  // Rattache sa ligne waitlist / son pin à ce compte (migration 00053).
  if (profile?.role === 'artist') void linkArtistAccountToMap()
  return { user: profile, error: null }
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut()
}

/** Envoie un email de réinitialisation de mot de passe (lien → /reset-password). */
export async function resetPasswordForEmail(
  email: string,
): Promise<{ error: AuthError | null }> {
  if (!hasSupabase()) return { error: { message: 'Supabase non configuré' } }
  const origin = window.location.origin
  const { error } = await supabase!.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin}/reset-password`,
  })
  return { error: error ? { message: error.message } : null }
}

/** Enregistre le nouveau mot de passe (session de récupération active). */
export async function updatePassword(
  newPassword: string,
): Promise<{ error: AuthError | null }> {
  if (!hasSupabase()) return { error: { message: 'Supabase non configuré' } }
  const { error } = await supabase!.auth.updateUser({ password: newPassword })
  return { error: error ? { message: error.message } : null }
}

/**
 * Met à jour le profil de l'utilisateur connecté (nom, ville, genres).
 * Seul le propriétaire du compte peut modifier sa propre ligne (RLS).
 */
export async function updateProfile(params: {
  displayName?: string
  city?: string
  district?: string
  country?: string
  favoriteGenres?: string[]
  avatarUrl?: string | null
}): Promise<{ error: AuthError | null }> {
  if (!hasSupabase()) return { error: { message: 'Supabase non configuré' } }
  const { data } = await supabase!.auth.getUser()
  if (!data.user) return { error: { message: 'Non connecté' } }
  const patch: Record<string, string | string[] | null> = {}
  if (params.displayName !== undefined) patch.display_name = params.displayName.trim()
  if (params.city !== undefined) patch.city = params.city.trim()
  if (params.district !== undefined) patch.district = params.district.trim()
  if (params.country !== undefined) patch.country = params.country.trim()
  if (params.favoriteGenres !== undefined) {
    patch.favorite_genres = params.favoriteGenres
      .map((g) => g.trim())
      .filter(Boolean)
  }
  if (params.avatarUrl !== undefined) patch.avatar_url = params.avatarUrl
  const { error } = await supabase!
    .from('profiles')
    .update(patch)
    .eq('id', data.user.id)
  if (error) return { error: { message: error.message } }
  return { error: null }
}

/** Lit le profil (rôle) de l'utilisateur connecté, avec petite réattente
 *  pour laisser le trigger handle_new_user créer la ligne. Tolérant :
 *  si la colonne account_type n'existe pas encore (migration en cours),
 *  on retombe sur les colonnes de base plutôt que d'échouer. */
export async function fetchProfile(
  userId: string,
  email: string | null,
): Promise<UserProfile | null> {
  if (!hasSupabase()) return null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let data: {
      display_name: string | null
      city: string | null
      district?: string | null
      country: string | null
      role: string | null
      account_type?: string | null
      favorite_genres?: string[] | null
      avatar_url?: string | null
    } | null = null
    let error: { message: string } | null = null
    type ProfileRow = {
      display_name: string | null
      city: string | null
      district?: string | null
      country: string | null
      role: string | null
      account_type?: string | null
      favorite_genres?: string[] | null
      avatar_url?: string | null
    }
    const full = await supabase!
      .from('profiles')
      .select('id, display_name, city, district, country, role, account_type, favorite_genres, avatar_url')
      .eq('id', userId)
      .maybeSingle()
    if (full.error && /account_type|favorite_genres/i.test(full.error.message)) {
      // Colonne absente (migration pas encore appliquée) : repli.
      const base = await supabase!
        .from('profiles')
        .select('id, display_name, city, role')
        .eq('id', userId)
        .maybeSingle()
      data = (base.data as ProfileRow | null) ?? null
      error = base.error ? { message: base.error.message } : null
    } else {
      data = (full.data as ProfileRow | null) ?? null
      error = full.error ? { message: full.error.message } : null
    }
    if (error) return null
    if (data) {
      let avatarUrl = data.avatar_url ?? null
      // Photo de la demande de référencement en attente : elle sert
      // d'avatar tant que le profil n'a pas de photo propre.
      if (!avatarUrl && data.role === 'artist') {
        try {
          const { data: ref } = await supabase!.rpc('my_referral_request')
          if (ref && typeof ref === 'object' && 'photo' in ref && (ref as { photo?: string | null }).photo) {
            avatarUrl = (ref as { photo: string }).photo
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
        accountType: data.account_type === 'business' ? 'business' : 'personal',
        favoriteGenres: data.favorite_genres ?? [],
        avatarUrl,
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)))
  }
  return null
}

/** Récupère la session courante + le profil. */
export async function getSessionProfile(): Promise<UserProfile | null> {
  if (!hasSupabase()) return null
  const { data } = await supabase!.auth.getUser()
  if (!data.user) return null
  const profile = await fetchProfile(data.user.id, data.user.email ?? null)
  // Artiste déjà connecté (session restaurée) : rattache sa ligne waitlist /
  // son pin à ce compte — couvre les comptes créés AVANT le déploiement 00053.
  if (profile?.role === 'artist') void linkArtistAccountToMap()
  return profile
}
