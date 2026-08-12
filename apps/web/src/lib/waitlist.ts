import { supabase, hasSupabase } from './supabase'
import {
  addOrUpdateMapArtist,
  geocodeArtistLocation,
  geocodeCityWithCountry,
  type DiscoveredArtist,
} from '@musimaps/shared'

/** Drapeau emoji d'un code ISO 3166-1 alpha-2 (« BJ » → 🇧🇯). */
function flagEmoji(countryCode: string | null | undefined): string {
  if (!countryCode || countryCode.length !== 2) return '🌍'
  const base = 0x1f1e6
  return String.fromCodePoint(
    base + countryCode.charCodeAt(0) - 65,
    base + countryCode.charCodeAt(1) - 65,
  )
}

export type Profile = 'artiste' | 'amateur'

export interface Signup {
  email: string
  profile: Profile
  artistName?: string
  city?: string
  /** Quartier / district saisi au référencement (ex. « Yopougon »). */
  district?: string
  genre?: string
  link?: string
  bio?: string
  photo?: string
  spotify?: string
  youtube?: string
  instagram?: string
  createdAt: string
  /** Compte connecté qui a soumis la demande (rattachement waitlist ↔ compte). */
  userId?: string
}

const KEY = 'musimaps.waitlist'

function readLocal(): Signup[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Signup[]) : []
  } catch {
    return []
  }
}

function saveLocal(signup: Signup) {
  try {
    const all = readLocal().filter((s) => s.email !== signup.email)
    localStorage.setItem(KEY, JSON.stringify([...all, signup]))
  } catch {
    /* stockage plein ou privé */
  }
}

export async function saveSignup(
  entry: Omit<Signup, 'createdAt'>,
  opts: { userId?: string } = {},
): Promise<Signup> {
  const signup: Signup = { ...entry, createdAt: new Date().toISOString(), userId: opts.userId }

  if (hasSupabase()) {
    const enriched = {
      email: signup.email,
      profile: signup.profile,
      artist_name: signup.artistName,
      city: signup.city,
      district: signup.district,
      genre: signup.genre,
      link: signup.link,
      bio: signup.bio,
      photo: signup.photo,
      spotify: signup.spotify,
      youtube: signup.youtube,
      instagram: signup.instagram,
      user_id: signup.userId ?? null,
      created_at: signup.createdAt,
    }
    const base = {
      email: signup.email,
      profile: signup.profile,
      artist_name: signup.artistName,
      city: signup.city,
      genre: signup.genre,
      link: signup.link,
      user_id: signup.userId ?? null,
      created_at: signup.createdAt,
    }
    const { error } = await supabase!.from('waitlist').upsert(enriched, { onConflict: 'email' })
    // Colonnes bio/photo/liens/user_id absentes (migrations 00021/00044 pas
    // encore appliquées) : on retombe sur l'upsert historique pour ne jamais
    // perdre la waitlist.
    if (error && /bio|photo|spotify|youtube|instagram|user_id/i.test(error.message)) {
      const retry = await supabase!.from('waitlist').upsert(base, { onConflict: 'email' })
      if (retry.error) console.error('Supabase insert failed, falling back to localStorage', retry.error.message)
      else return signup
    } else if (error) {
      console.error('Supabase insert failed, falling back to localStorage', error.message)
    } else {
      return signup
    }
  }

  saveLocal(signup)
  return signup
}

/** Upload une image dans le bucket public artist-images et renvoie son URL.
 *  `folder` permet de distinguer photos / covers sans dupliquer la logique. */
export async function uploadArtistPhoto(
  file: File,
  folder: 'artists' | 'covers' = 'artists',
): Promise<{ url: string; error?: string }> {
  if (!hasSupabase()) return { url: '', error: 'Supabase non configuré' }
  if (file.size > 5 * 1024 * 1024) return { url: '', error: 'Photo trop lourde (max 5 Mo).' }
  if (!/^image\/(png|jpe?g|webp|gif|avif)$/i.test(file.type)) {
    return { url: '', error: 'Format non supporté (PNG, JPG, WebP, GIF, AVIF).' }
  }
  const path = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`
  const { error: uploadError } = await supabase!.storage
    .from('artist-images')
    .upload(path, file, { upsert: false })
  if (uploadError) return { url: '', error: uploadError.message }
  const { data } = supabase!.storage.from('artist-images').getPublicUrl(path)
  return { url: data.publicUrl }
}

export function readSignups(): Signup[] {
  return readLocal()
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

// ------------------------------------------------------------
// Conversion waitlist → carte (après lancement)
// ------------------------------------------------------------

/** Une ligne de la table waitlist prête pour la conversion. */
export interface WaitlistRow {
  id: string | number
  email: string
  profile: 'artiste' | 'amateur' | 'user' | 'artist'
  artist_name: string | null
  city: string | null
  district: string | null
  country: string | null
  genre: string | null
  link: string | null
  bio: string | null
  photo: string | null
  spotify: string | null
  youtube: string | null
  instagram: string | null
  user_id: string | null
  converted_at: string | null
  map_artist_id: string | null
  created_at: string
}

/**
 * Convertit une entrée artiste de la liste d'attente en pin sur la carte :
 * géocode la ville (Mapbox), crée/met à jour le profil artiste avec les
 * liens collectés, puis marque l'entrée comme convertie. Utilisé par l'admin
 * (conversion manuelle) et par le script de lancement (conversion batch).
 */
export async function convertWaitlistToMap(
  row: WaitlistRow,
): Promise<{ ok: boolean; error?: string; mapArtistId?: string; marked?: boolean; markError?: string }> {
  const name = row.artist_name?.trim()
  const city = row.city?.trim()
  const district = row.district?.trim()
  if (!name || !city) {
    return { ok: false, error: 'Nom d’artiste et ville requis pour la conversion.' }
  }
  // Le quartier prime : « Yopougon, Abidjan, CI » positionne le pin dans le
  // vrai quartier (et non le centre-ville) — les artistes d'une même ville
  // mais de quartiers différents ne s'empilent jamais.
  let located: { lng: number; lat: number; country: string; flag: string } | null = null
  if (district) {
    const coords = await geocodeArtistLocation(city, row.country ?? '', district)
    if (coords) {
      // Le pays vient du géocodage quand l'entrée n'en déclare pas : le pin
      // garde un drapeau et un regroupement pays cohérents (parité avec le
      // chemin sans quartier, qui résout le pays via geocodeCityWithCountry).
      located = {
        lng: coords.lng,
        lat: coords.lat,
        country: coords.country ?? row.country?.trim() ?? '',
        flag: flagEmoji(coords.country ?? row.country),
      }
    }
  }
  if (!located) {
    located = await geocodeCityWithCountry(city)
  }
  if (!located) {
    return { ok: false, error: `Ville introuvable pour « ${name} » (${city}).` }
  }

  const platforms: DiscoveredArtist['platforms'] = {}
  if (row.spotify?.trim()) platforms.spotify = row.spotify.trim()
  if (row.youtube?.trim()) platforms.youtube = row.youtube.trim()
  const socials: DiscoveredArtist['socials'] = {}
  if (row.instagram?.trim()) socials.instagram = row.instagram.trim()

  // Un id stable et déterministe par email : convertir deux fois la même
  // entrée met à jour le même pin au lieu d'en créer un doublon. On retire
  // d'abord le suffixe +alias (plus-addressing) pour éviter la collision
  // avec une adresse sans alias.
  const baseEmail = row.email.toLowerCase().split('+')[0]
  const stableId = `waitlist-${baseEmail.replace(/[^a-z0-9@.\-_]/g, '-')}`
  const result = await addOrUpdateMapArtist(
    {
      id: stableId,
      name,
      genre: row.genre?.trim() ?? '',
      city,
      district: district || undefined,
      country: located.country,
      flag: located.flag,
      lat: located.lat,
      lng: located.lng,
      bio: row.bio ?? '',
      image: row.photo || undefined,
      source: 'waitlist',
      platforms,
      socials,
    },
    // La ligne waitlist a un user_id (compte déjà lié, migration 00044) :
    // on revendique le pin pour ce compte dès la conversion.
    { claimedBy: row.user_id ?? undefined },
  )
  if (!result.ok) return { ok: false, error: result.error }

  // Le pin est créé : la conversion est réussie. Le marquage n'est qu'un
  // traçage (évite les reconversions) — on le signale sans faire échouer la
  // conversion si les colonnes 00044 sont absentes ou si le PATCH échoue.
  const stamp = new Date().toISOString()
  const { error: markError } = await supabase!
    .from('waitlist')
    .update({ converted_at: stamp, map_artist_id: stableId })
    .eq('id', row.id)
  return {
    ok: true,
    mapArtistId: stableId,
    marked: !markError,
    markError: markError ? markError.message : undefined,
  }
}

/** La demande de référencement de l'utilisateur connecté (ou null). */
export interface MyReferralRequest {
  id: string | number
  email: string
  artistName: string | null
  city: string | null
  genre: string | null
  bio: string | null
  photo: string | null
  spotify: string | null
  youtube: string | null
  instagram: string | null
  convertedAt: string | null
  mapArtistId: string | null
  createdAt: string
}

/**
 * Lit la demande de référencement de l'utilisateur connecté (sa ligne
 * waitlist, via user_id). Lecture impossible en anon (RLS admin) : on passe
 * par le RPC SECURITY DEFINER my_referral_request (migration 00045).
 */
export async function fetchMyReferralRequest(): Promise<MyReferralRequest | null> {
  if (!hasSupabase()) return null
  const { data, error } = await supabase!.rpc('my_referral_request')
  if (error) return null
  return (data as MyReferralRequest | null) ?? null
}

/** Lien d'invitation à la création de compte (amateur, après lancement). */
export function inviteLink(email: string, role: 'artist' | 'melomane' = 'melomane') {
  const base =
    typeof window !== 'undefined'
      ? `${window.location.origin}/signup`
      : 'https://musimaps.app/signup'
  return `${base}?email=${encodeURIComponent(email)}&role=${role}`
}
