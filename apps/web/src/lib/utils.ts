import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formate un nombre compact (1,2 k / 3,4 M) pour les libellés de graphiques. */
export function compactNumber(value: number): string {
  const n = Math.round(value)
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace('.', ',')} M`
  if (n >= 10_000) return `${Math.round(n / 1000)} k`
  if (n >= 1_000) return `${(n / 1000).toFixed(1).replace('.', ',')} k`
  return String(n)
}
