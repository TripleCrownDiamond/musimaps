export type Profile = 'artiste' | 'amateur'

export interface Signup {
  email: string
  profile: Profile
  /** Champs remplis uniquement par le formulaire artiste. */
  artistName?: string
  city?: string
  genre?: string
  link?: string
  createdAt: string
}

const KEY = 'musimaps.waitlist'

/**
 * Stockage local en attendant un backend. Suffisant pour un site de pre-lancement :
 * l'inscription est confirmee a l'utilisateur et conservee sur son appareil.
 */
export function readSignups(): Signup[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Signup[]) : []
  } catch {
    return []
  }
}

export function saveSignup(entry: Omit<Signup, 'createdAt'>): Signup {
  const signup: Signup = { ...entry, createdAt: new Date().toISOString() }
  try {
    const all = readSignups().filter((s) => s.email !== signup.email)
    localStorage.setItem(KEY, JSON.stringify([...all, signup]))
  } catch {
    // Mode prive ou stockage plein : l'inscription reste confirmee a l'ecran.
  }
  return signup
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim())
}

/** Rang affiche apres inscription, pour donner un sentiment de file d'attente. */
export function positionFor(email: string) {
  const base = 1247
  let hash = 0
  for (const char of email) hash = (hash * 31 + char.charCodeAt(0)) % 500
  return base + hash
}
