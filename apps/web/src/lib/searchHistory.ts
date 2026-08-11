/**
 * Historique de recherche (localStorage).
 * Récent d'abord, dédupliqué, plafonné à 8 entrées.
 */
const KEY = 'musimaps.searchHistory'
const MAX = 8

export function getSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX)
  } catch {
    return []
  }
}

/** Ajoute une requête en tête de l'historique (dédupliquée, insensible à la casse). */
export function addSearchHistory(query: string): string[] {
  const q = query.trim()
  if (!q) return getSearchHistory()
  const next = [
    q,
    ...getSearchHistory().filter(
      (item) => item.toLocaleLowerCase('fr') !== q.toLocaleLowerCase('fr'),
    ),
  ].slice(0, MAX)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* stockage indisponible : l'historique vit en mémoire pour la session */
  }
  return next
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* silencieux */
  }
}
