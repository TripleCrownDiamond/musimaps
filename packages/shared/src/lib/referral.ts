import { getSupabase } from '../runtime';

/** La demande de référencement de l'utilisateur connecté (ou null). */
export interface MyReferralRequest {
  id: string | number;
  email: string;
  artistName: string | null;
  city: string | null;
  genre: string | null;
  bio: string | null;
  photo: string | null;
  spotify: string | null;
  youtube: string | null;
  instagram: string | null;
  convertedAt: string | null;
  mapArtistId: string | null;
  createdAt: string;
}

/**
 * Lit la demande de référencement de l'utilisateur connecté (sa ligne
 * waitlist, via user_id). Lecture impossible en anon (RLS admin) : on passe
 * par le RPC SECURITY DEFINER my_referral_request (migration 00045).
 */
export async function fetchMyReferralRequest(): Promise<MyReferralRequest | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_referral_request');
  if (error) return null;
  return (data as MyReferralRequest | null) ?? null;
}
