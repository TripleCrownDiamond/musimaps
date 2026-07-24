import { supabase, hasSupabase } from './supabase'

export type Profile = 'artiste' | 'amateur'

export interface Signup {
  email: string
  profile: Profile
  artistName?: string
  city?: string
  genre?: string
  link?: string
  createdAt: string
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

export async function saveSignup(entry: Omit<Signup, 'createdAt'>): Promise<Signup> {
  const signup: Signup = { ...entry, createdAt: new Date().toISOString() }

  if (hasSupabase()) {
    const { error } = await supabase!.from('waitlist').upsert(
      { email: signup.email, profile: signup.profile, artist_name: signup.artistName, city: signup.city, genre: signup.genre, link: signup.link, created_at: signup.createdAt },
      { onConflict: 'email' }
    )
    if (error) console.error('Supabase insert failed, falling back to localStorage', error.message)
    else return signup
  }

  saveLocal(signup)
  return signup
}

export function readSignups(): Signup[] {
  return readLocal()
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

export function positionFor(email: string) {
  const base = 1247
  let hash = 0
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) % 500
  return base + hash
}