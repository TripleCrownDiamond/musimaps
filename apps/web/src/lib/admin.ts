import { supabase, hasSupabase } from './supabase'

export interface AuthResult {
  user: { email: string | null; hasIdentities: boolean } | null
  error: { message: string } | null
}

/** L'utilisateur connecté est-il administrateur ? */
export async function isAdminUser(email: string | null | undefined): Promise<boolean> {
  if (!email || !hasSupabase()) return false
  const { data, error } = await supabase!
    .from('admins')
    .select('email')
    .eq('email', email)
    .maybeSingle()
  return !error && Boolean(data)
}

/** Inscription (premier compte) — la RLS n'autorise l'insert qu'à vide. */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (!hasSupabase()) return { user: null, error: { message: 'Supabase non configuré' } }
  const { data, error } = await supabase!.auth.signUp({ email, password })
  return {
    user: data.user
      ? { email: data.user.email ?? null, hasIdentities: Boolean(data.user.identities?.length) }
      : null,
    error,
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (!hasSupabase()) return { user: null, error: { message: 'Supabase non configuré' } }
  const { data, error } = await supabase!.auth.signInWithPassword({ email, password })
  return {
    user: data.user ? { email: data.user.email ?? null, hasIdentities: false } : null,
    error,
  }
}

export async function signOut() {
  await supabase?.auth.signOut()
}

export async function currentUserEmail(): Promise<string | null> {
  if (!hasSupabase()) return null
  const { data } = await supabase!.auth.getUser()
  return data.user?.email ?? null
}
