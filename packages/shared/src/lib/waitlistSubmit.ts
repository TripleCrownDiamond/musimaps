import { getSupabase } from '../runtime'

/** Demande de référencement, colonnes de la table `waitlist`. */
export interface WaitlistSubmission {
  email: string
  profile: string
  artist_name?: string | null
  city?: string | null
  country?: string | null
  district?: string | null
  genre?: string | null
  link?: string | null
  bio?: string | null
  photo?: string | null
  spotify?: string | null
  youtube?: string | null
  instagram?: string | null
  /** Utilisé seulement par l'ancien chemin (sans 00083) : le serveur prend la session. */
  user_id?: string | null
}

export type WaitlistSubmitResult = { ok: true; duplicate: boolean } | { ok: false; error: string }

/** Le RPC n'existe pas encore en base (migration 00083 non appliquée). */
const MISSING_RPC = /PGRST202|submit_waitlist|could not find the function/i

/**
 * Envoie une demande de référencement (web + mobile).
 *
 * Passe par le RPC submit_waitlist (00083) : le compte vient de la
 * session, une demande existante ne se réécrit que par son auteur, et le
 * volume est borné. Tant que la migration n'est pas en base, retombe sur
 * l'upsert historique — d'abord avec toutes les colonnes, puis sans
 * celles qui manqueraient (00021 / 00044).
 */
export async function submitWaitlistEntry(entry: WaitlistSubmission): Promise<WaitlistSubmitResult> {
  const supabase = getSupabase()
  if (!supabase) return { ok: false, error: 'Supabase non configuré' }

  const { user_id: _session, ...payload } = entry
  const { data, error } = await supabase.rpc('submit_waitlist', { p_entry: payload })
  if (!error) {
    const result = data as { ok?: boolean; error?: string; duplicate?: boolean } | null
    return result?.ok
      ? { ok: true, duplicate: result.duplicate === true }
      : { ok: false, error: result?.error ?? 'Erreur inconnue' }
  }
  if (!MISSING_RPC.test(`${error.code ?? ''} ${error.message}`)) return { ok: false, error: error.message }

  const legacy = await supabase.from('waitlist').upsert(entry, { onConflict: 'email' })
  if (!legacy.error) return { ok: true, duplicate: false }
  if (!/bio|photo|spotify|youtube|instagram|user_id|country/i.test(legacy.error.message)) {
    return { ok: false, error: legacy.error.message }
  }
  const base = {
    email: entry.email,
    profile: entry.profile,
    artist_name: entry.artist_name ?? null,
    city: entry.city ?? null,
    district: entry.district ?? null,
    genre: entry.genre ?? null,
    link: entry.link ?? null,
  }
  const retry = await supabase.from('waitlist').upsert(base, { onConflict: 'email' })
  return retry.error ? { ok: false, error: retry.error.message } : { ok: true, duplicate: false }
}
