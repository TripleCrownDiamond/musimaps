import { supabase, hasSupabase } from './supabase'

export type BookingPref = 'email' | 'whatsapp' | 'phone' | 'any'

export interface BookingRequest {
  artistId: string
  artistName: string
  eventType: string
  eventDate: string
  flexible: boolean
  city: string
  country: string
  address: string
  budgetRange: string
  budgetAmount: string
  audienceSize: string
  message: string
  contactName: string
  company: string
  phone: string
  website: string
  instagram: string
  linkedin: string
  contactPrefs: BookingPref[]
}

/** Vérifie si l'email appartient à un abonné (plan réservation). */
export async function isSubscriber(email: string): Promise<boolean> {
  if (!hasSupabase() || !email.trim()) return false
  const { data, error } = await supabase!.rpc('is_subscriber', {
    p_email: email.trim(),
  })
  return !error && data === true
}

/**
 * Crée une réservation via le RPC sécurisé : l'email et l'utilisateur
 * proviennent du JWT (jamais du client). Nécessite un compte connecté
 * ET un abonnement actif sur l'email du compte.
 */
export async function requestBooking(
  input: BookingRequest,
): Promise<{ ok: boolean; error?: string }> {
  if (!hasSupabase()) return { ok: false, error: 'Supabase non configuré' }
  const { data, error } = await supabase!.rpc('request_booking', {
    p_artist_id: input.artistId,
    p_artist_name: input.artistName,
    p_event_type: input.eventType || null,
    p_event_date: input.eventDate || null,
    p_flexible: input.flexible,
    p_city: input.city,
    p_country: input.country,
    p_address: input.address,
    p_budget_range: input.budgetRange || null,
    p_budget_amount: input.budgetAmount || null,
    p_audience_size: input.audienceSize || null,
    p_message: input.message,
    p_contact_name: input.contactName,
    p_company: input.company,
    p_phone: input.phone,
    p_website: input.website,
    p_instagram: input.instagram,
    p_linkedin: input.linkedin,
    p_contact_prefs: input.contactPrefs,
  })
  if (error) return { ok: false, error: error.message }
  const result = data as { ok?: boolean; error?: string } | null
  return result?.ok
    ? { ok: true }
    : { ok: false, error: result?.error ?? 'Erreur inconnue' }
}

export type BookingStatus = 'pending' | 'confirmed' | 'rejected'

export interface BookingRecord {
  id: string
  artist_id: string
  artist_name: string
  user_email: string
  event_type: string | null
  event_date: string | null
  flexible_date: boolean
  city: string | null
  country: string | null
  budget_range: string | null
  budget_amount: string | null
  audience_size: string | null
  message: string | null
  contact_name: string | null
  company: string | null
  phone: string | null
  status: BookingStatus
  created_at: string
}

/** Demandes visibles par l'utilisateur connecté (RLS : siennes, reçues si artiste, toutes si admin). */
export async function fetchBookings(): Promise<BookingRecord[]> {
  if (!hasSupabase()) return []
  const { data, error } = await supabase!
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
  return error ? [] : ((data ?? []) as BookingRecord[])
}
