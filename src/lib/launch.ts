/**
 * Date de lancement, pilotee par VITE_LAUNCH_DATE (format ISO).
 * Defaut : 19 aout 2026, soit 30 jours apres la mise en place du compteur.
 */
const FALLBACK = '2026-08-19T12:00:00Z'

const raw = import.meta.env.VITE_LAUNCH_DATE as string | undefined
const parsed = raw ? new Date(raw) : null

export const LAUNCH_DATE =
  parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(FALLBACK)

export interface Countdown {
  days: number
  hours: number
  minutes: number
  seconds: number
  /** true une fois la date de lancement atteinte. */
  launched: boolean
}

export function getCountdown(now: Date = new Date()): Countdown {
  const diff = LAUNCH_DATE.getTime() - now.getTime()
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, launched: true }
  const seconds = Math.floor(diff / 1000)
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    launched: false,
  }
}
