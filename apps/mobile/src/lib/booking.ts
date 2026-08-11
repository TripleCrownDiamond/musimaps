import { supabase } from './supabase';

export type BookingPref = 'email' | 'whatsapp' | 'phone' | 'any';

export interface BookingRequest {
  artistId: string;
  artistName: string;
  eventType: string;
  eventDate: string;
  flexible: boolean;
  city: string;
  country: string;
  address: string;
  budgetRange: string;
  budgetAmount: string;
  audienceSize: string;
  message: string;
  contactName: string;
  company: string;
  phone: string;
  website: string;
  instagram: string;
  linkedin: string;
  contactPrefs: BookingPref[];
}

export async function isSubscriber(email: string): Promise<boolean> {
  if (!supabase || !email.trim()) return false;
  const { data, error } = await supabase.rpc('is_subscriber', {
    p_email: email.trim(),
  });
  return !error && data === true;
}

/** Crée une réservation via le RPC sécurisé (email = celui du compte connecté). */
export async function requestBooking(
  input: BookingRequest,
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase non configuré' };
  const { data, error } = await supabase.rpc('request_booking', {
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
  });
  if (error) return { ok: false, error: error.message };
  const result = data as { ok?: boolean; error?: string } | null;
  return result?.ok
    ? { ok: true }
    : { ok: false, error: result?.error ?? 'Erreur inconnue' };
}

export interface BookingPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  duration: string | null;
  active: boolean;
}

export interface ArtistBooking {
  bookable: boolean;
  plans: BookingPlan[];
}

/** Réservable + forfaits d'un artiste (migration 00048, lecture publique). */
export async function fetchArtistBooking(
  artistId: string,
): Promise<ArtistBooking | null> {
  if (!supabase || !artistId) return null;
  const { data, error } = await supabase.rpc('get_artist_booking', {
    p_artist_id: artistId,
  });
  if (error || !data) return null;
  const booking = data as ArtistBooking | null;
  return booking && Array.isArray(booking.plans) ? booking : null;
}

export type BookingStatus = 'pending' | 'confirmed' | 'rejected';

export interface BookingRecord {
  id: string;
  artist_id: string;
  artist_name: string;
  user_email: string;
  event_type: string | null;
  event_date: string | null;
  flexible_date: boolean;
  city: string | null;
  country: string | null;
  budget_range: string | null;
  budget_amount: string | null;
  audience_size: string | null;
  message: string | null;
  contact_name: string | null;
  company: string | null;
  phone: string | null;
  status: BookingStatus;
  created_at: string;
}

/** Demandes visibles par l'utilisateur connecté (RLS : siennes, reçues si artiste, toutes si admin). */
export async function fetchBookings(): Promise<BookingRecord[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false });
  return error ? [] : ((data ?? []) as BookingRecord[]);
}
